import * as cheerio from "cheerio";
import fs from "fs-extra";
import path from "path";
import { logAction } from "../db/sqlite";
import { resolvePath } from "../utils/path";

interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface WebpageContent {
  url: string;
  title: string;
  content: string;
  links: { text: string; url: string }[];
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// ─── 搜索引擎适配器 ──────────────────────────────────────

async function searchGoogle(
  query: string,
  maxResults: number
): Promise<WebSearchResult[]> {
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=${maxResults}`;
  const resp = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8" },
    signal: AbortSignal.timeout(15000),
  });
  const html = await resp.text();
  const $ = cheerio.load(html);
  const results: WebSearchResult[] = [];

  $("div.g, div[data-sokoban-container]").each((_, el) => {
    if (results.length >= maxResults) return false;
    const $el = $(el);
    const $h3 = $el.find("h3").first();
    const title = $h3.text().trim();
    const $a = $h3.closest("a").length ? $h3.closest("a") : $el.find("a").first();
    const link = $a.attr("href") || "";
    const snippet = $el.find("div[data-sncf], div.VwiC3b, span.aCOpRe").first().text().trim();

    if (title && link && link.startsWith("http")) {
      results.push({ title, url: link, snippet: snippet.slice(0, 400) });
    }
  });

  return results;
}

async function searchBaidu(
  query: string,
  maxResults: number
): Promise<WebSearchResult[]> {
  const url = `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`;
  const resp = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(15000),
  });
  const html = await resp.text();
  const $ = cheerio.load(html);
  const results: WebSearchResult[] = [];

  $("li.b_algo, div.result").each((_, el) => {
    if (results.length >= maxResults) return false;
    const $el = $(el);
    const $h3 = $el.find("h3").first();
    const title = $h3.text().trim();
    const link = $h3.find("a").first().attr("href") || $el.find("a").first().attr("href") || "";
    const snippet = $el.find("p, .c-abstract, span.content-right_8Zs40").first().text().trim();

    if (title && link && link.startsWith("http")) {
      results.push({ title, url: link, snippet: snippet.slice(0, 400) });
    }
  });

  return results;
}

async function searchBing(
  query: string,
  maxResults: number
): Promise<WebSearchResult[]> {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=${maxResults}`;
  const resp = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(15000),
  });
  const html = await resp.text();
  const $ = cheerio.load(html);
  const results: WebSearchResult[] = [];

  $("li.b_algo").each((_, el) => {
    if (results.length >= maxResults) return false;
    const $el = $(el);
    const $h2 = $el.find("h2").first();
    const title = $h2.text().trim();
    const link = $h2.find("a").first().attr("href") || "";
    const snippet = $el.find("p, .b_caption p").first().text().trim();

    if (title && link && link.startsWith("http")) {
      results.push({ title, url: link, snippet: snippet.slice(0, 400) });
    }
  });

  return results;
}

// ─── 多引擎搜索 ──────────────────────────────────────────

async function search(
  query: string,
  maxResults: number,
  engine: "auto" | "google" | "baidu" | "bing" = "auto"
): Promise<WebSearchResult[]> {
  const engines = {
    google: searchGoogle,
    baidu: searchBaidu,
    bing: searchBing,
  };

  if (engine !== "auto") {
    try {
      return await engines[engine](query, maxResults);
    } catch {
      // 如果指定引擎失败，回退到自动模式
    }
  }

  // 自动模式：依次尝试，第一个成功的返回
  for (const [name, fn] of Object.entries(engines)) {
    try {
      const results = await fn(query, maxResults);
      if (results.length > 0) return results;
    } catch {
      continue;
    }
  }

  return [];
}

// ─── 页面抓取 ──────────────────────────────────────────

export const fetchWebpage = async (
  url: string,
  extractMode: "text" | "links" | "full" = "text",
  maxChars: number = 5000
): Promise<WebpageContent> => {
  const resp = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(20000),
  });
  const html = await resp.text();
  const $ = cheerio.load(html);

  // 移除无关元素
  $("script, style, nav, footer, header, aside, .ad, .ads, .sidebar").remove();

  const title = $("title").text().trim() || $("h1").first().text().trim() || "无标题";

  let content = "";
  if (extractMode === "text" || extractMode === "full") {
    // 提取主要文本内容
    const mainContent = $("article, main, .content, .post, .entry-content, #content").first();
    content = (mainContent.length ? mainContent : $("body")).text()
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxChars);
  }

  const links: { text: string; url: string }[] = [];
  if (extractMode === "links" || extractMode === "full") {
    $("a[href]").each((_, el) => {
      const $a = $(el);
      const text = $a.text().trim();
      const href = $a.attr("href") || "";
      if (text && href && href.startsWith("http") && links.length < 20) {
        links.push({ text: text.slice(0, 100), url: href });
      }
    });
  }

  await logAction("fetchWebpage", { url, title, contentLength: content.length });

  return { url, title, content, links };
};

// ─── 导出的搜索函数 ──────────────────────────────────────

export const webSearch = async (
  query: string,
  maxResults: number = 5,
  engine: "auto" | "google" | "baidu" | "bing" = "auto"
): Promise<string> => {
  try {
    const results = await search(query, maxResults, engine);

    if (results.length === 0) {
      return `未找到与"${query}"相关的搜索结果。`;
    }

    const output = results
      .map(
        (r, i) =>
          `[${i + 1}] ${r.title}\n    ${r.url}\n    ${r.snippet || "(无摘要)"}`
      )
      .join("\n\n");

    await logAction("webSearch", { query, resultCount: results.length, engine });

    return `搜索"${query}"找到 ${results.length} 条结果:\n\n${output}`;
  } catch (error: any) {
    return `搜索失败: ${error?.message || error}`;
  }
};

export const webSearchAndSave = async (
  query: string,
  savePath: string,
  maxResults: number = 10,
  format: "txt" | "json" | "md" = "txt",
  engine: "auto" | "google" | "baidu" | "bing" = "auto"
): Promise<string> => {
  try {
    const results = await search(query, maxResults, engine);

    if (results.length === 0) {
      return `未找到与"${query}"相关的搜索结果，无法保存。`;
    }

    let content: string;
    const absolutePath = resolvePath(savePath);

    switch (format) {
      case "json":
        content = JSON.stringify(
          { query, timestamp: new Date().toISOString(), results },
          null,
          2
        );
        break;
      case "md":
        content =
          `# 搜索结果: ${query}\n\n` +
          `> 搜索时间: ${new Date().toLocaleString()}\n\n` +
          results
            .map(
              (r, i) =>
                `## ${i + 1}. ${r.title}\n\n${r.snippet || ""}\n\n[链接](${r.url})\n`
            )
            .join("\n---\n\n");
        break;
      default:
        content =
          `搜索结果: ${query}\n${"=".repeat(50)}\n\n` +
          results
            .map(
              (r, i) =>
                `[${i + 1}] ${r.title}\n    ${r.url}\n    ${r.snippet || "(无摘要)"}`
            )
            .join("\n\n");
    }

    const dir = path.dirname(absolutePath);
    await fs.ensureDir(dir);
    await fs.writeFile(absolutePath, content, "utf-8");

    await logAction("webSearchAndSave", {
      query,
      savePath: absolutePath,
      resultCount: results.length,
      format,
      engine,
    });

    return `搜索"${query}"找到 ${results.length} 条结果，已保存到 ${absolutePath}`;
  } catch (error: any) {
    return `搜索或保存失败: ${error?.message || error}`;
  }
};
