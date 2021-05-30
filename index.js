import fs from "fs";
import parser from "iptv-playlist-parser";
import probe from "ffmpeg-probe";
import Promise from "bluebird";

import { EOL } from "os";

const tvgOut = (tvg, type = "tvg") =>
  typeof tvg === "object" && Object.keys(tvg).length > 0
    ? " " +
      Object.keys(tvg)
        .map((a) => (tvg[a] ? `${type}-${a}=${JSON.stringify(tvg[a])}` : null))
        .filter((a) => a)
        .join(" ") +
      " "
    : "";
const linkCheckCache = {};
const linkValidator = async (data) => {
  if (!data) return null;
  if (typeof linkCheckCache[data.url] !== "undefined") return false; // skip duples
  const out = [];
  const info = await probe(data.url).catch((error) => ({ error }));
  if (
    !info ||
    info.error ||
    !info.streams ||
    !Array.isArray(info.streams) ||
    info.streams.length < 1
  ) {
    linkCheckCache[data.url] = false;
    console.debug("error", data.url, info.error || "no streams");
    return null;
  }
  const streams = info.streams.filter((s) => s.codec_type === "audio"); // skip images etc
  if (streams && Array.isArray(streams) && streams.length > 0) {
    console.log("validated", data.url, streams.length);
    data.group = data.group || {};
    data.group.title = data.group.title || "none";
    out.push(
      "#EXTINF:-1" +
        tvgOut(data.tvg) +
        tvgOut(data.group, "group") +
        "," +
        data.name
    );

    //  out.push("#EXTGRP:" + data.group.title);
    out.push(data.url, "");
    linkCheckCache[data.url] = true;
  } else {
    console.log("no valid streams in ", data.url);
    linkCheckCache[data.url] = false;
  }
  return out.join(EOL);
};

const m3uValidator = async (inFilename, outFilename) => {
  const parsed = parser.parse(
    fs.readFileSync(inFilename, { encoding: "utf-8" })
  );
  //   console.log(parsed)
  if (parsed && parsed.items && Array.isArray(parsed.items)) {
    const out = await Promise.map(parsed.items, linkValidator, {
      concurrency: 5,
    });
    //   console.log("out", out);
    if (parsed.header && parsed.header.raw) out.unshift(parsed.header.raw, "");
    else out.filter((o) => o).unshift("#EXTM3U", "");
    fs.writeFileSync(outFilename, out.join(EOL));
  }
};

m3uValidator("./smarttvnews_in.m3u", "./smarttvnews.m3u");
// m3uValidator("./il.m3u", "./local.m3u");
