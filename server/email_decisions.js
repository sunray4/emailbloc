const insecure_schemes = [
  "javascript:",
  "data:",
  "file:",
  "blob:",
  "ftp:",
  "http",
];

function email_decisions(json) {
  
  const obj = JSON.parse(json); 
  console.log(obj);
  let insecure_score = 0; // each insecure feature on the website has a weight score (based on how much risk the user becomes exposed to), and the scores of all features are added up

  if (insecure_schemes.includes(obj["scheme"])) {
    insecure_score += 4;
  }
  insecure_score += obj["num_badthirdPartyRequests"] || 0;
  // console.log(obj["url"] ? obj["url"] : "**");
  // console.log(obj.url ? obj.url : "**");
  // console.log(obj["csp"] ? obj["csp"] : "**");
  if (!obj["csp"] || !obj["csp"]["implemented"]) {
    insecure_score += 6;
  } else {
    for (const data of obj["csp"]["data"] || []) {
      if (
        data == "CSP in HTTP response header invalid" &&
        !obj["csp"]["meta"]
      ) {
        insecure_score += 6;
      } else if (
        data == "CSP in HTTP response header invalid" &&
        obj["csp"]["meta"]
      ) {
        insecure_score += 4;
      } else if (data == "Dangerously broad directives") insecure_score += 5;
      else if (data == "Insecure scheme") insecure_score += 5;
      else if (data == "Unsafe-eval used") insecure_score += 3;
      else if (data == "Insecure scheme when loading passive content")
        insecure_score += 2;
      else if (
        data == "Dangerously broad directives used in implementing styles"
      )
        insecure_score += 3;
      else if (data == "Unsafe base URI using overly broad directives")
        insecure_score += 3;
    }
  }
  console.log(insecure_score);

  


  return insecure_score;
}

module.exports = { email_decisions };