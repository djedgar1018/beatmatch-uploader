const https = require("https");

export const config = {
  api: { bodyParser: false, responseLimit: false },
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Filename");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const cloudName = "dtwvkmgz8";
  const uploadPreset = "beatmatch_mixes";
  const boundary = "----BeatmatchBoundary" + Date.now();
  const filename = req.headers["x-filename"] || "mix.mp3";
  const mimeType = req.headers["content-type"] || "audio/mpeg";

  const presetPart = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="upload_preset"\r\n\r\n${uploadPreset}\r\n`
  );
  const filePart = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`
  );
  const endPart = Buffer.from(`\r\n--${boundary}--\r\n`);

  return new Promise((resolve) => {
    const cloudReq = https.request({
      method: "POST",
      hostname: "api.cloudinary.com",
      path: `/v1_1/${cloudName}/auto/upload`,
      headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    }, (cloudRes) => {
      let body = "";
      cloudRes.on("data", (d) => (body += d));
      cloudRes.on("end", () => {
        try {
          const data = JSON.parse(body);
          if (data.secure_url) res.status(200).json({ url: data.secure_url });
          else res.status(500).json({ error: data.error?.message || body.slice(0, 200) });
        } catch { res.status(500).json({ error: "Parse error", raw: body.slice(0, 200) }); }
        resolve();
      });
    });
    cloudReq.on("error", (e) => { res.status(500).json({ error: e.message }); resolve(); });
    cloudReq.write(presetPart);
    cloudReq.write(filePart);
    req.on("data", (chunk) => cloudReq.write(chunk));
    req.on("end", () => { cloudReq.write(endPart); cloudReq.end(); });
    req.on("error", (e) => { res.status(500).json({ error: e.message }); resolve(); });
  });
}
