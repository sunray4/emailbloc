"use strict";
const cors = require("cors");
const express = require("express");
const path = require("path");
const puppeteer = require("puppeteer");
const { TimeoutError } = puppeteer;
const { URL } = require("url");
const log4js = require("log4js");
const tldjs = require("tldjs");
const ipaddr = require("ipaddr.js");
const { worker } = require("./worker.js");
const { email_decisions } = require("./email_decisions.js");

log4js.configure({
  appenders: {
    out: { type: "stdout" },
    app: { type: "file", filename: "server-logger.log" },
  },
  categories: {
    default: {
      appenders: ["out", "app"],
      level: "info",
    },
  },
});

const logger = log4js.getLogger();
const PORT = process.env.PORT || 8100;
const app = express();

app.use(express.static(".")); //or put html in public and serve from there?
app.use(cors());

app.get("/", (req, res) => {
  // Send the HTML file as the response
  res.sendFile(path.join(__dirname, "temp.html"));
});

function urldecode(url) {
  return decodeURIComponent(url.replace(/\+/g, " "));
}

app.get("/check", async (request, response) => {
  logger.info("enter check");
  const url = urldecode(request.query.fetch_url);
  const validateUrl = request.query.validate_url
    ? request.query.validate_url !== "false"
    : true;

  try {
    const parsedUrl = new URL(urldecode(request.query.fetch_url));

    if (validateUrl) {
      if (
        !["http:", "https:"].includes(parsedUrl.protocol) ||
        !tldjs.parse(parsedUrl.hostname).tldExists
      ) {
        return response
          .status(500)
          .type("application/json")
          .send(
            JSON.stringify({
              success: false,
              reason: "Failed to fetch this URL: invalid protocol or tld",
            })
          );
      }
    }
  } catch (err) {
    return response
      .status(500)
      .type("application/json")
      .send(
        JSON.stringify({
          success: false,
          reason: "Failed to fetch this URL: invalid URL",
        })
      );
  }

  logger.info("Trying " + url);

  const timeout = request.query.timeout || 25000;
  const browser = await puppeteer.launch({ headless: true });
  const viewport = {
    width: 1920,
    height: 1080,
  };

  try {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    const client = await page.target().createCDPSession();

    await page.setViewport(viewport);
    await page.setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3803.0 Safari/537.36"
    );

    if (validateUrl) {
      await page.setRequestInterception(true);
      page.on("request", (interceptedRequest) => {
        const parsedTld = tldjs.parse(interceptedRequest.url());
        const parsedUrl = new URL(interceptedRequest.url());

        let ipIsPrivate = false;
        if (ipaddr.isValid(parsedTld.hostname)) {
          const addr = ipaddr.parse(parsedTld.hostname);
          if (
            [
              "private",
              "loopback",
              "linkLocal",
              "broadcast",
              "reserved",
            ].includes(addr.range())
          ) {
            ipIsPrivate = true;
          }
        }

        if (
          (parsedTld.isIp && ipIsPrivate) ||
          (!parsedTld.isIp && !parsedTld.tldExists) ||
          (parsedUrl.port !== "" && !["80", "443"].includes(parsedUrl.port))
        ) {
          interceptedRequest.abort();
        } else {
          interceptedRequest.continue();
        }
      });
    }

    const responses = [];
    page.on("response", (response) => {
      if (response.remoteAddress().ip) {
        responses.push({
          url: response.url(),
          remote_address: response.remoteAddress(),
          headers: response.headers(),
        });
      }
    });

    await client.send("Audits.enable");
    let mixedContent = {};
    // client.on("Audits.issueAdded", (audit) => {
    //   if (audit.issue.code == "MixedContentIssue") {
    //     if (
    //       ["MixedContentBlocked", "MixedContentWarning"].includes(
    //         audit.issue.details.mixedContentIssueDetails.resolutionStatus
    //       )
    //     ) {
    //       mixedContent[
    //         audit.issue.details.mixedContentIssueDetails.insecureURL
    //       ] = {
    //         resourceType:
    //           audit.issue.details.mixedContentIssueDetails.resourceType,
    //         mainResourceURL:
    //           audit.issue.details.mixedContentIssueDetails.mainResourceURL,
    //         resolutionStatus:
    //           audit.issue.details.mixedContentIssueDetails.resolutionStatus,
    //       };
    //     }
    //   }
    // });

    let pageResponse;
    for (const waitUntilSetting of [
      ["domcontentloaded", "networkidle2"],
      "networkidle2",
      "load",
    ]) {
      try {
        pageResponse = await page.goto(url, {
          waitUntil: waitUntilSetting,
          timeout: timeout,
        });
        if (pageResponse) {
          break;
        }
      } catch (err) {
        if (err instanceof TimeoutError) {
          logger.info(`${url} timed out`);
        } else {
          throw err;
        }
      }
    }
    if (pageResponse == null) {
      throw "Page timeout";
    }

    console.log("received page response");

    let securityInfo = {};
    if (pageResponse.securityDetails()) {
      securityInfo = {
        issuer: pageResponse.securityDetails().issuer(),
        protocol: pageResponse.securityDetails().protocol(),
        subjectAlternativeNames: pageResponse
          .securityDetails()
          .subjectAlternativeNames(),
        subjectName: pageResponse.securityDetails().subjectName(),
        validFrom: pageResponse.securityDetails().validFrom(),
        validTo: pageResponse.securityDetails().validTo(),
      };
    }

    await new Promise((r) => setTimeout(r, 10000));
    console.log("beofre content");
    const content = await page.content();
    // Necessary to get *ALL* cookies
    const cookies = await client.send("Network.getAllCookies");
    console.log("after content");
    // let localStorage = await page.evaluate(() => { return {...localStorage}; });
    // ^- prettier, but we've got to truncate things for sanity:
    let localStorageData = {};
    try {
      localStorageData = await page.evaluate(() => {
        const tmpObj = {};
        const keys = Object.keys(localStorage);
        for (let i = 0; i < keys.length; ++i) {
          tmpObj[keys[i].substring(0, 100)] = localStorage
            .getItem(keys[i])
            .substring(0, 100);
        }
        return tmpObj;
      });
    } catch (err) {
      console.log(
        `Accessing localStorage failed. This shouldn't happen. Error:`
      );
      console.log(err);
    }

    const title = await page.title();
    const finalUrl = await page.url();
    const parsedUrl = new URL(finalUrl);
    const isValidUrl =
      tldjs.parse(parsedUrl.hostname).tldExists || validateUrl === false;

    const responseHeaders = pageResponse.headers();
    const responseStatus = pageResponse.status();

    let webbkollStatus = 200;
    let results;
    if (responseStatus >= 200 && responseStatus <= 299 && isValidUrl) {
      // TODO: Use response interception when available
      // (https://github.com/GoogleChrome/puppeteer/issues/1191)
      if (
        responseHeaders["content-type"] &&
        (responseHeaders["content-type"].startsWith("text/html") ||
          responseHeaders["content-type"].startsWith("application/xhtml+xml"))
      ) {
        logger.info(`Successfully checked ${url}`);
        results = {
          success: true,
          input_url: url,
          final_url: finalUrl,
          responses: responses,
          response_headers: responseHeaders,
          status: responseStatus,
          remote_address: pageResponse.remoteAddress(),
          cookies: cookies.cookies,
          localStorage: localStorageData,
          security_info: securityInfo,
          mixed_content: mixedContent,
          content: content.substring(0, 5000000), // upper limit for sanity
        };
        logger.info("reached results");
        // logger.info(results)
      } else {
        logger.warn(`Failed checking ${url}: ${responseStatus}`);
        results = {
          success: false,
          reason: "Page does not have text/html Content-Type",
          response_headers: responseHeaders,
        };
        webbkollStatus = 500;
      }
    } else if (!isValidUrl) {
      logger.warn(`Failed checking ${url}: ${responseStatus}`);
      results = {
        success: false,
        reason: "Invalid URL.",
      };
      webbkollStatus = 500;
    } else {
      logger.warn(`Failed checking ${url}: ${responseStatus}`);
      results = {
        success: false,
        reason: `Failed to fetch this URL: ${responseStatus} (${title})`,
        response_headers: responseHeaders,
        response_status: responseStatus,
        response_title: title,
      };
      webbkollStatus = 500;
    }

    console.log("at regex");
    const regex =
      /([^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFC\u{10000}-\u{10FFFF}])/gu;

    let results_json = JSON.stringify(results, (key, val) => {
      if (typeof val === "string") {
        return val.replace(regex, "");
      }
      return val;
    });
    console.log("got results json");
    let analysis_json = await worker(results_json);
    console.log("got analysis");
    // logger.info("results:" + results);
    // logger.info("results json:" + results_json);
    // logger.info("analysis:" + analysis);
    let score = await email_decisions(analysis_json);
    console.log("got score");

    response.status(webbkollStatus).type("application/json").send([JSON.parse(analysis_json), score]);
    await context.close();
  } catch (err) {
    logger.warn(`Failed checking ${url}: ${err.toString()}`);
    response
      .status(500)
      .type("application/json")
      .send(
        JSON.stringify({
          success: false,
          reason: `Failed to fetch this URL: ${err.toString()}`,
        })
      );
  }
  await browser.close();
  logger.info(`Finished with ${url}`);
});

app.get("/status", async (request, response) => {
  response.status(200).send("OK!");
});

app.listen(PORT, function () {
  logger.info(`Webkoll backend listening on port ${PORT}`);
});