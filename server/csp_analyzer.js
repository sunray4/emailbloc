const dangerously_broad = [
  "ftp:",
  "http:",
  "*:",
  "*",
  "http://*",
  "http://*.*",
  "data:",
  "blob:",
  "'unsafe-eval'",
  "'unsafe-inline'",
];
const passiveDirectives = ["img-src", "media-src"];
const nonce_hash = ["'sha256-", "'sha384-", "'sha512-", "'nonce-"];

async function csp_analyzer(scheme, header, meta) {
  console.log("in csp analyser");
  let output = {
    header: false,
    meta: false,
    pass: false,
    data: [],
    policy: {
      // antiClickjacking: false,
      // defaultNone: false,
      // insecureBaseUri: false,
      // insecureFormAction: false,
      // insecureSchemeActive: false,
      // insecureSchemePassive: false,
      strictDynamic: false,
      // unsafeEval: false,
      // unsafeInline: false,
      // unsafeInlineStyle: false,
      // unsafeObjects: false,
    },
    implemented: false,
  };
  if (header === null && meta == null) {
    return output;
  }

  let parsed_header = await parse_content(header);
  let parsed_meta = await parse_content(meta);
  console.log("got parsed");
  let csp = null;
  if (parsed_header && parsed_meta) {
    csp = await merge_dict(parsed_header, parsed_meta);
    output.header = true;
    output.meta = true;
  } else if (parsed_header) {
    csp = parsed_header;
    output.header = true;
  } else if (parsed_meta) {
    csp = parsed_meta;
    output.meta = true;
  }
  if (!csp) {
    return output;
  }
  console.log("got csp");

  const base_uri = csp["base-uri"] || [];
  const form_action = csp["form-action"] || [];
  let script_src = csp["script-src"] || [];
  let style_src = csp["style-src"] || [];
  let object_src = csp["object-src"] || [];
  const frame_ancestors = csp["frame-ancestors"] || [];
  console.log("got csome more info");
  const active_csp_sources = script_src.concat(
    Object.entries(csp).reduce((acc, [directive, sources]) => {
      if (
        !passiveDirectives.includes(directive) &&
        directive !== "script-src"
      ) {
        return acc.concat(sources);
      }
      return acc;
    }, [])
  );
  console.log("got more info");
  const passive_csp_sources = Object.entries(csp).reduce(
    (acc, [directive, sources]) => {
      if (
        passiveDirectives.includes(directive) ||
        directive === "default-src"
      ) {
        return acc.concat(sources);
      }
      return acc;
    },
    []
  );
  console.log("got passive");
  let { source: a, opt: b } = await check_strict_dynamic(script_src, output);
  script_src = a;
  output = b;
  console.log("got strict dynamic");
  let checks = [
    [
      has_intersection(script_src, dangerously_broad) ||
        has_intersection(object_src, dangerously_broad),
      "Dangerously broad directives",
    ],
    [
      scheme == "https" &&
        (active_csp_sources.includes("http:") ||
          active_csp_sources.includes("ftp:")) &&
        !output.policy.strictDynamic,
      "Insecure scheme",
    ],
    [
      script_src.includes("'unsafe-eval'") ||
        script_src.includes("'unsafe-eval'"),
      "Unsafe-eval used",
    ],
    [
      (scheme == "https" &&
        (passive_csp_sources.includes("http") ||
          passive_csp_sources.includes("ftp:")),
      "Insecure scheme when loading passive content"),
    ],
    [
      has_intersection(style_src, dangerously_broad),
      "Dangerously broad directives used in implementing styles",
    ],
    [
      (has_intersection(base_uri, dangerously_broad),
      "Unsafe base URI using overly broad directives"),
    ],
  ];
  console.log("got checks");
  for (let i = 0; i < checks.length; i++) {
    if (checks[i][0]) {
      output.data.push(checks[i][1]);
    }
  }
  output.implemented = true;

  return output;
}

function parse_content(content) {
  if (typeof content !== "string") {
    return null;
  }

  return content
    .replace(/\n/g, ";")
    .trim()
    .split(";")
    .map((item) => item.trim())
    .filter((item) => item.length > 6)
    .reduce((dict, item) => {
      let parts = item.split(/\s+/);
      let key = parts[0].toLowerCase();
      let values = parts.slice(1);

      values = values.map((v) => v.toLowerCase());
      if (!(key in dict)) {
        dict[key] = values;
      } else {
        dict[key] = dict[key].concat(values);
      }
      return dict;
    }, {});
}

function merge_dict(dict1, dict2) {
  const merged = { ...dict1 };
  for (const key in dict2) {
    if (key in merged) {
      merged[key] = merged[key].concat(dict2[key]);
    } else {
      merged[key] = dict2[key];
    }
  }
  return merged;
}

function check_for_nonce_hash(src) {
  for (let i = 0; i < src.length; i++) {
    for (let j = 0; j < nonce_hash.length; j++) {
      if (src[i].startsWith(nonce_hash[j])) {
        return true;
      }
    }
  }
  return false;
}

function has_intersection(list1, list2) {
  const set1 = new Set(list1);
  for (const item of list2) {
    if (set1.has(item)) return true;
  }
  return false;
}

function check_strict_dynamic(src, output) {
  const has_nonce = check_for_nonce_hash(src);
  let new_src = src;
  if (has_nonce) {
    if (src.includes("'strict-dynamic'")) {
      new_src = src.filter(
        (i) => !dangerously_broad.includes(i) && i != "'self'"
      );
      output.policy.strictDynamic = true;
    }
  } else {
    if (src.includes("'strict-dynamic'")) {
      output.data.push("CSP in HTTP response header invalid");
    }
  }
  return { source: new_src, opt: output };
}
module.exports = { csp_analyzer };