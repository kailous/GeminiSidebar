/**
 * Extractor Script (Lightweight Readability + Markdown)
 * This script is injected into the target page to extract main content.
 */

(function() {
  function extract() {
    // 1. Find the main content
    const article = findMainContent();
    if (!article) return { title: document.title, body: "无法提取主正文内容。", url: window.location.href };

    // 2. Clean up the article
    const cleanedArticle = cleanElement(article.cloneNode(true));

    // 3. Convert to Markdown
    const markdown = toMarkdown(cleanedArticle);

    return {
      title: document.title,
      body: markdown,
      url: window.location.href
    };
  }

  /**
   * Simple Readability-lite algorithm
   */
  function findMainContent() {
    const elements = document.querySelectorAll('article, main, .article, .post, .content, .entry-content');
    if (elements.length > 0) {
      // Find the one with most paragraphs
      let best = elements[0];
      let maxP = 0;
      elements.forEach(el => {
        const count = el.querySelectorAll('p').length;
        if (count > maxP) {
          maxP = count;
          best = el;
        }
      });
      if (maxP > 2) return best;
    }

    // Fallback: look for the div with the most p tags
    const divs = document.querySelectorAll('div');
    let bestDiv = null;
    let maxCount = 0;
    divs.forEach(div => {
      const count = div.querySelectorAll('p').length;
      if (count > maxCount) {
        maxCount = count;
        bestDiv = div;
      }
    });

    return bestDiv || document.body;
  }

  /**
   * Basic cleanup: remove scripts, styles, hidden elements
   */
  function cleanElement(el) {
    const exclude = el.querySelectorAll('script, style, iframe, noscript, .ads, .sidebar, .nav, footer, header');
    exclude.forEach(node => node.remove());
    return el;
  }

  /**
   * Basic HTML to Markdown converter
   */
  function toMarkdown(el) {
    let md = "";

    function walk(node) {
      if (node.nodeType === 3) { // Text
        md += node.textContent.replace(/\s+/g, ' ');
        return;
      }

      if (node.nodeType !== 1) return; // Not an element

      const tag = node.tagName.toLowerCase();
      
      // Prevent nesting issues for simple converter
      const prefix = "";
      const suffix = "";

      switch(tag) {
        case 'h1': md += "\n# "; break;
        case 'h2': md += "\n## "; break;
        case 'h3': md += "\n### "; break;
        case 'h4': md += "\n#### "; break;
        case 'p': md += "\n\n"; break;
        case 'br': md += "\n"; break;
        case 'li': md += "\n- "; break;
        case 'strong': case 'b': md += "**"; break;
        case 'em': case 'i': md += "*"; break;
        case 'a': md += "["; break;
        case 'img': md += "![图片]("; break;
        case 'blockquote': md += "\n> "; break;
        case 'code': md += "`"; break;
        case 'pre': md += "\n```\n"; break;
      }

      for (const child of node.childNodes) {
        walk(child);
      }

      switch(tag) {
        case 'p': case 'h1': case 'h2': case 'h3': case 'h4': md += "\n"; break;
        case 'strong': case 'b': md += "**"; break;
        case 'em': case 'i': md += "*"; break;
        case 'a': md += `](${node.href})`; break;
        case 'img': md += `) `; break;
        case 'code': md += "`"; break;
        case 'pre': md += "\n```\n"; break;
      }
    }

    walk(el);
    return md.replace(/\n{3,}/g, '\n\n').trim();
  }

  // Execute and return result
  return extract();
})();
