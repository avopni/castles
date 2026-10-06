// Optional reproducible research download. Not part of the website or deployment.
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
const sources = [
  [
    "capstone-rulebook-v2.pdf",
    "https://capstone-games.com/cdn/shop/files/WanderingTowers_Rulebook-v2web.pdf?v=14815768852878472978",
  ],
  [
    "abacus-rulebook.pdf",
    "https://abacusspiele.de/wp-content/uploads/2023/11/WandelndeTuerme_Regel_EN__Korr210623_low.pdf",
  ],
  [
    "abacus-faq.pdf",
    "https://abacusspiele.de/wp-content/uploads/2022/07/WandelndeTuerme_FAQ_EN.pdf",
  ],
  [
    "publisher-page.html",
    "https://abacusspiele.de/produkt/die-wandelnden-tuerme/",
  ],
];
await fs.mkdir(".tools/research", { recursive: true });
const entries = await Promise.all(
  sources.map(async ([file, url]) => {
    const response = await fetch(url);
    if (!response.ok) throw Error(`${response.status}: ${url}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(`.tools/research/${file}`, bytes);
    return {
      file,
      url,
      status: response.status,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  }),
);
await fs.writeFile(
  ".tools/research/manifest.json",
  JSON.stringify({ retrieved: new Date().toISOString(), entries }, null, 2),
);
console.log(entries.map((e) => `${e.file}: ${e.bytes} bytes`).join("\n"));
