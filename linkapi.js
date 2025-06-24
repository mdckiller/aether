const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

class LinkAPI {
    constructor(config) {
        this.config = config;
        this.openaiConfig = config.openai;
    }

    async processLink(url, mode = 'formatted', includeImages = false) {
        try {
            // Fetch the webpage
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const html = await response.text();
            const dom = new JSDOM(html, { url });
            const document = dom.window.document;

            // Use Readability to extract article content
            const reader = new Readability(document);
            const article = reader.parse();

            if (!article) {
                throw new Error('Could not parse article content');
            }

            let processedHtml;
            const title = article.title || 'Untitled';

            switch (mode) {
                case 'formatted':
                    processedHtml = await this.processFormattedContent(article.content, includeImages, url);
                    break;
                case 'plain':
                    processedHtml = this.processPlainContent(article.textContent);
                    break;
                case 'summary':
                    const plainText = article.textContent;
                    processedHtml = await this.processSummaryContent(plainText);
                    break;
                default:
                    throw new Error(`Unknown mode: ${mode}`);
            }

            return {
                title,
                html: processedHtml,
                metadata: {
                    url,
                    mode,
                    includeImages,
                    originalTitle: article.title,
                    excerpt: article.excerpt,
                    length: article.length,
                    siteName: article.siteName
                }
            };

        } catch (error) {
            console.error('Error processing link:', error);
            throw error;
        }
    }

    async processFormattedContent(content, includeImages, baseUrl) {
        // Apply selective cleaning that preserves images and important content
        content = this.preCleanHtml(content, includeImages);
        
        if (!includeImages) {
            // Remove all images when includeImages is false
            const dom = new JSDOM(content);
            const document = dom.window.document;
            const images = document.querySelectorAll('img');
            images.forEach(img => img.remove());
            return this.cleanHtmlForQuill(document.body.innerHTML);
        }

        // Create a DOM from the content to process images
        const dom = new JSDOM(content);
        const document = dom.window.document;
        const images = document.querySelectorAll('img');

        for (const img of images) {
            try {
                const imgSrc = img.src;
                let absoluteUrl;

                // Convert relative URLs to absolute
                if (imgSrc.startsWith('http')) {
                    absoluteUrl = imgSrc;
                } else if (imgSrc.startsWith('//')) {
                    absoluteUrl = 'https:' + imgSrc;
                } else {
                    absoluteUrl = new URL(imgSrc, baseUrl).href;
                }

                // Fetch and convert image to base64
                const base64Data = await this.imageToBase64(absoluteUrl);
                if (base64Data) {
                    img.src = base64Data;
                }
            } catch (error) {
                console.warn('Failed to process image:', img.src, error.message);
                // Remove broken images
                img.remove();
            }
        }

        return this.cleanHtmlForQuill(document.body.innerHTML);
    }

    preCleanHtml(html, includeImages = false) {
        // Selective cleaning that preserves content structure and images
        const dom = new JSDOM(html);
        const document = dom.window.document;

        // Only remove truly problematic elements, be more conservative
        const problematicElements = document.querySelectorAll(
            'script, style, noscript, ' +
            'form, input, button, select, textarea, ' +
            '.advertisement, .ads, ' +
            '[class*="ad-"], [id*="ad-"]'
        );
        problematicElements.forEach(el => el.remove());

        // Light cleanup of excessive whitespace - be more conservative
        this.lightCleanWhitespace(document);

        // Only remove truly excessive consecutive <br> tags (more than 3)
        this.cleanExcessiveBrTags(document);

        // Remove images if includeImages is false
        if (!includeImages) {
            const images = document.querySelectorAll('img');
            images.forEach(img => img.remove());
        }
        
        // Only remove completely empty elements that don't contain media
        const emptyElements = document.querySelectorAll('p, div, span');
        emptyElements.forEach(el => {
            const hasMedia = el.querySelector(includeImages ? 'img, video, audio, iframe, br' : 'video, audio, iframe, br');
            const hasText = el.textContent.trim();
            const hasChildren = el.children.length > 0;
            
            // Only remove if truly empty (no text, no media, no child elements)
            if (!hasText && !hasMedia && !hasChildren) {
                el.remove();
            }
        });

        // Minimal HTML cleanup - preserve more structure
        let cleanedHtml = document.body.innerHTML;
        cleanedHtml = cleanedHtml.replace(/\s{3,}/g, ' '); // Only replace 3+ spaces with single space
        
        return cleanedHtml;
    }

    lightCleanWhitespace(document) {
        // Light cleanup of whitespace - more conservative approach
        const walker = document.createTreeWalker(
            document.body,
            document.defaultView.NodeFilter.SHOW_TEXT,
            null,
            false
        );

        let node;
        while (node = walker.nextNode()) {
            // Only clean truly excessive whitespace, preserve single spaces and line breaks
            if (/^\s*$/.test(node.textContent) && node.textContent.length > 2) {
                // Only remove if it's more than 2 whitespace characters
                node.textContent = ' ';
            } else if (node.textContent) {
                // Only replace 3+ consecutive spaces with 2 spaces
                node.textContent = node.textContent.replace(/\s{3,}/g, '  ');
            }
        }
    }

    cleanExcessiveBrTags(document) {
        // Find all <br> tags and only remove truly excessive ones
        const brTags = document.querySelectorAll('br');
        let consecutiveCount = 0;
        let previousBr = null;
        const brsToRemove = [];

        brTags.forEach(br => {
            // Check if this br is immediately following another br
            if (previousBr && this.isConsecutiveBr(previousBr, br)) {
                consecutiveCount++;
                // Keep maximum 3 consecutive <br> tags (more lenient)
                if (consecutiveCount >= 3) {
                    brsToRemove.push(br);
                }
            } else {
                consecutiveCount = 0;
            }
            previousBr = br;
        });

        brsToRemove.forEach(br => br.remove());
    }

    isConsecutiveBr(br1, br2) {
         let current = br1.nextSibling;
         while (current && current !== br2) {
             // If there's any non-whitespace content between br tags, they're not consecutive
             if (current.nodeType === 3 && current.textContent.trim()) { // Text node with content
                 return false;
             }
             if (current.nodeType === 1 && current.tagName !== 'BR') { // Element node that's not BR
                 return false;
             }
             current = current.nextSibling;
         }
         return current === br2;
     }

     fixNestedParagraphs(document) {
         // Fix nested paragraphs like <p><p>content</p></p>
         const nestedParagraphs = document.querySelectorAll('p p, p div, div p');
         nestedParagraphs.forEach(nested => {
             const parent = nested.parentNode;
             if (parent && (parent.tagName === 'P' || parent.tagName === 'DIV')) {
                 // Move the nested element's content to the parent level
                 while (nested.firstChild) {
                     parent.insertBefore(nested.firstChild, nested);
                 }
                 nested.remove();
             }
         });

         // Remove paragraphs that only contain other block elements
         const paragraphs = document.querySelectorAll('p');
         paragraphs.forEach(p => {
             const hasOnlyBlockElements = Array.from(p.childNodes).every(child => {
                 if (child.nodeType === 3) { // Text node
                     return !child.textContent.trim(); // Only whitespace
                 }
                 if (child.nodeType === 1) { // Element node
                     return ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'BLOCKQUOTE'].includes(child.tagName);
                 }
                 return false;
             });

             if (hasOnlyBlockElements && p.children.length > 0) {
                 // Move children out of the paragraph
                 while (p.firstChild) {
                     p.parentNode.insertBefore(p.firstChild, p);
                 }
                 p.remove();
             }
         });

         // Clean up paragraphs with only links or minimal content
         const linkOnlyParagraphs = document.querySelectorAll('p');
         linkOnlyParagraphs.forEach(p => {
             const textContent = p.textContent.trim();
             const links = p.querySelectorAll('a');
             
             // If paragraph contains only links with single letters or minimal content
             if (links.length > 0 && textContent.length <= 3 && /^[A-Za-z\s]*$/.test(textContent)) {
                 p.remove();
             }
         });
     }

    processPlainContent(textContent) {
        // Convert plain text to simple HTML paragraphs
        const paragraphs = textContent
            .split('\n\n')
            .filter(p => p.trim().length > 0)
            .map(p => `<p>${this.escapeHtml(p.trim())}</p>`)
            .join('');

        return paragraphs || '<p>No content available</p>';
    }

    async processSummaryContent(plainText) {
        try {
            const summary = await this.generateSummary(plainText);
            return this.escapeHtml(summary);
        } catch (error) {
            console.error('Error generating summary:', error);
            // Fallback to plain content
            return this.processPlainContent(plainText);
        }
    }

    async generateSummary(text) {
        if (!this.openaiConfig || !this.openaiConfig.apiKey) {
            throw new Error('OpenAI configuration not found');
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.openaiConfig.apiKey}`
            },
            body: JSON.stringify({
                model: this.openaiConfig.model || 'gpt-4',
                messages: [
                    {
                        role: 'user',
                        content: `${this.openaiConfig.prompt}\n\n${text}`
                    }
                ],
                max_tokens: 500,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || 'Summary not available';
    }

    async imageToBase64(imageUrl) {
        try {
            const response = await fetch(imageUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.startsWith('image/')) {
                throw new Error('Not an image');
            }

            const buffer = await response.buffer();
            const base64 = buffer.toString('base64');
            return `data:${contentType};base64,${base64}`;
        } catch (error) {
            console.warn('Failed to convert image to base64:', imageUrl, error.message);
            return null;
        }
    }

    cleanHtmlForQuill(html) {
        // Create a DOM to clean the HTML
        const dom = new JSDOM(html);
        const document = dom.window.document;

        // Remove script and style tags
        const scripts = document.querySelectorAll('script, style, noscript');
        scripts.forEach(el => el.remove());

        // Remove dangerous attributes and keep only Quill-compatible ones
        const allElements = document.querySelectorAll('*');
        allElements.forEach(el => {
            // Keep only safe attributes
            const allowedAttrs = ['href', 'src', 'alt', 'title', 'target'];
            const attrs = Array.from(el.attributes);
            attrs.forEach(attr => {
                if (!allowedAttrs.includes(attr.name)) {
                    el.removeAttribute(attr.name);
                }
            });
        });

        // Convert tables to simple text representation
        const tables = document.querySelectorAll('table');
        tables.forEach(table => {
            const fragment = document.createDocumentFragment();
            
            const rows = table.querySelectorAll('tr');
            rows.forEach((row, index) => {
                const cells = row.querySelectorAll('td, th');
                const rowText = Array.from(cells).map(cell => cell.textContent.trim()).filter(text => text).join(' | ');
                if (rowText) {
                    const p = document.createElement('p');
                    if (index === 0 && row.querySelector('th')) {
                        p.innerHTML = `<strong>${this.escapeHtml(rowText)}</strong>`;
                    } else {
                        p.textContent = rowText;
                    }
                    fragment.appendChild(p);
                }
            });
            
            table.parentNode.replaceChild(fragment, table);
        });

        // Remove or convert unsupported elements
        const unsupportedElements = document.querySelectorAll('figure, aside, nav, footer, header, main, section, article');
        unsupportedElements.forEach(el => {
            // Replace with div temporarily for further processing
            const div = document.createElement('div');
            div.innerHTML = el.innerHTML;
            el.parentNode.replaceChild(div, el);
        });

        // More conservative handling of divs and spans
        const divsAndSpans = document.querySelectorAll('div, span');
        divsAndSpans.forEach(el => {
            const textContent = el.textContent.trim();
            const hasMedia = el.querySelector('img, video, audio, iframe, figure');
            
            // Don't remove elements that contain media or have meaningful content
            if (!textContent && !hasMedia) {
                el.remove();
                return;
            }

            // If it contains block elements or media, unwrap it
            if (el.querySelector('p, h1, h2, h3, h4, h5, h6, ul, ol, blockquote, img, figure')) {
                this.unwrapElement(el);
            } else if (textContent) {
                // Only convert to paragraph if it has text content and no media
                if (!hasMedia) {
                    const p = document.createElement('p');
                    p.innerHTML = el.innerHTML;
                    el.parentNode.replaceChild(p, el);
                }
            }
        });

        // More conservative removal of empty elements
        const emptyElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6');
        emptyElements.forEach(el => {
            // Only remove if truly empty (no text, no media, no child elements)
            if (!el.textContent.trim() && !el.querySelector('img, video, audio, iframe, figure, br') && el.children.length === 0) {
                el.remove();
            }
        });

        // Get the cleaned content
        let cleanedHtml = document.body.innerHTML;

        // Remove any remaining wrapper divs at the root level
        if (cleanedHtml.startsWith('<div>') && cleanedHtml.endsWith('</div>')) {
            const tempDom = new JSDOM(cleanedHtml);
            const tempDoc = tempDom.window.document;
            const rootDiv = tempDoc.querySelector('div');
            if (rootDiv && rootDiv.parentNode === tempDoc.body && tempDoc.body.children.length === 1) {
                cleanedHtml = rootDiv.innerHTML;
            }
        }

        return cleanedHtml;
    }

    unwrapElement(element) {
        // Move all child nodes to the parent
        const parent = element.parentNode;
        while (element.firstChild) {
            parent.insertBefore(element.firstChild, element);
        }
        parent.removeChild(element);
    }

    escapeHtml(text) {
        const div = new JSDOM().window.document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

module.exports = LinkAPI;