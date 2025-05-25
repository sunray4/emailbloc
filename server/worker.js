const { parse } = require("tldts");
const htmlparser = require("htmlparser2");
const whiteList = [
  "awswaf.com",
  "cloudfront.net",
  "newrelic.com",
  "nr-data.net",
  "clarity.ms",
  "amazonaws.com",
  "cloudflare.com",
  "cloudflarestatic.com",
  "cloudflareinsights.com",
];
const { csp_analyzer } = require("./csp_analyzer.js");

async function worker(json) {
  console.log("at worker");
  const data = JSON.parse(json);
  console.log("got data");
  const url = parse(data.final_url);
  const url_scheme = new URL(data.final_url).protocol;
  console.log("got urls");
  const registerableDomain = url.domain;
  console.log("got url domain");
  const [thirdpartyrequests, num_badthirdPartyRequests] =
    await get_3rd_party_requests(data.responses, registerableDomain);
  console.log("got 3rd party requests");
  const response_headers = data.response_headers;

  const csp = await csp_analyzer(
    url_scheme,
    get_header(data.response_headers, "content-security-policy"),
    get_meta(data.content, "http-equiv", "content-security-policy")
  );
  console.log("got csp");
  const analysis = {
    url: url,
    scheme: url_scheme,
    registerableDomain: registerableDomain,
    thirdpartyrequests: thirdpartyrequests,
    num_badthirdPartyRequests: num_badthirdPartyRequests,
    csp: csp,
  };

  const regex =
    /([^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFC\u{10000}-\u{10FFFF}])/gu;

  const analysis_json = JSON.stringify(analysis, (key, val) => {
    if (typeof val === "string") {
      return val.replace(regex, "");
    }
    return val;
  });
  return analysis_json;
}

module.exports = { worker };

function get_3rd_party_requests(requests, registerableDomain) {
  let num_uniquethirdPartyRequests = 0;
  let thirdpartyrequests = {};
  requests.forEach((request) => {
    const domain = parse(request.url).domain;
    if (
      domain !== null &&
      !whiteList.includes(domain) &&
      domain !== registerableDomain
    ) {
      if (!thirdpartyrequests[domain]) {
        num_uniquethirdPartyRequests++;
        thirdpartyrequests[domain] = [[], false];
      }
      thirdpartyrequests[domain][0].push(request.url);
    } else if (
      domain !== null &&
      whiteList.includes(domain) &&
      domain !== registerableDomain
    ) {
      if (!thirdpartyrequests[domain]) {
        thirdpartyrequests[domain] = [[], true];
      }
      thirdpartyrequests[domain][0].push(request.url);
    }
  });
  return [thirdpartyrequests, num_uniquethirdPartyRequests];
}

function get_header(headers, header) {
  for (const header_key in headers) {
    if (header_key.toLowerCase() === header) {
      return headers[header_key];
    }
  }
  return null;
}

function get_meta(html, attribute, value) {
  let found = null;
  const parser = new htmlparser.Parser({
    onopentag(name, attrs) {
      if (
        name === "meta" &&
        attribute in attrs &&
        attrs[attribute].toLowerCase() === value.toLowerCase() &&
        "content" in attrs
      ) {
        found = attrs.content;
      }
    },
  });
  parser.write(html);
  parser.end();

  return found;
}