"use client"

import React from "react"
import { useRef, useState, useCallback, useEffect } from "react"
import { Theme } from "@swc-react/theme"
import { Button } from "@swc-react/button"
import { Textfield } from "@swc-react/textfield"
import { Picker } from "@swc-react/picker"
import { MenuItem } from "@swc-react/menu"
import { FieldLabel } from "@swc-react/field-label"
import { ProgressCircle } from "@swc-react/progress-circle"
import "@spectrum-web-components/theme/express/scale-medium.js"
import "@spectrum-web-components/theme/express/theme-light.js"
import type { AddOnSDKAPI } from "https://new.express.adobe.com/static/add-on-sdk/sdk.js"
import "./App.css"

interface AppProps {
  addOnUISdk: AddOnSDKAPI
}

interface ScrapedContent {
  title: string
  content: string
  description?: string
  author?: string
  date?: string
}

interface GeneratedInfographic {
  url: string
  title: string
  sourceUrl: string
}

const App: React.FC<AppProps> = ({ addOnUISdk }) => {
  const [url, setUrl] = useState("")
  const [customPrompt, setCustomPrompt] = useState("")
  const [size, setSize] = useState("1024x1536")
  const [quality, setQuality] = useState("high")
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedInfographic, setGeneratedInfographic] = useState<GeneratedInfographic | null>(null)
  const [error, setError] = useState("")
  const [progress, setProgress] = useState("")

  // Hardcoded API keys
  const FAL_API_KEY = "fal-ai-key"
  const OPENAI_API_KEY = "open-ai-key"

  const scrapeUrl = async (url: string): Promise<ScrapedContent> => {
    console.log("🔍 Starting URL scraping for:", url)
    setProgress("Scraping blog content...")

    // Validate the URL format
    let validatedUrl: URL
    try {
      validatedUrl = new URL(url)
      if (validatedUrl.protocol !== "http:" && validatedUrl.protocol !== "https:") {
        throw new Error("Invalid URL protocol")
      }
    } catch (error) {
      throw new Error("Invalid URL")
    }

    // Fetch the content from the URL
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch content: ${response.statusText}`)
      }

      const contentType = response.headers.get("content-type") || ""
      if (!contentType.includes("text/html")) {
        throw new Error("The URL does not point to a valid HTML page")
      }

      const html = await response.text()

      // Parse HTML using DOMParser (browser-compatible)
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, "text/html")

      // Extract relevant information
      const title = doc.querySelector("title")?.textContent?.trim() || 
                   doc.querySelector("h1")?.textContent?.trim() || ""

      const description = doc.querySelector('meta[name="description"]')?.getAttribute("content") ||
                         doc.querySelector('meta[property="og:description"]')?.getAttribute("content") || ""

      const datePublished = doc.querySelector('meta[property="article:published_time"]')?.getAttribute("content") ||
                           doc.querySelector("time")?.getAttribute("datetime") || ""

      const author = doc.querySelector('meta[name="author"]')?.getAttribute("content") ||
                    doc.querySelector('meta[property="article:author"]')?.getAttribute("content") ||
                    doc.querySelector(".author")?.textContent?.trim() || ""

      // Remove unwanted elements
      const unwantedSelectors = [
        "script", "style", "noscript", "iframe", "nav", "header", "footer", 
        "aside", ".sidebar", ".nav", ".menu", ".comments", ".ad", ".advertisement", "form"
      ]
      
      unwantedSelectors.forEach(selector => {
        doc.querySelectorAll(selector).forEach(el => el.remove())
      })

      // Extract main content
      let mainContent = ""
      const contentSelectors = [
        "article", ".post-content", ".article-content", ".entry-content",
        ".content", "main", "#content", ".post", ".article", ".blog-post",
        ".post-body", ".story-body", ".entry", ".single-post", ".blog-content",
        ".article-body", ".post-text", ".content-area", ".main-content",
        "[role='main']", ".entry-summary", ".post-excerpt"
      ]

      for (const selector of contentSelectors) {
        const element = doc.querySelector(selector)
        if (element) {
          const selectedContent = element.textContent?.trim() || ""
          if (selectedContent && selectedContent.length > mainContent.length) {
            mainContent = selectedContent
          }
        }
      }

      // If still no content found, take the body
      if (!mainContent) {
        mainContent = doc.body?.textContent?.trim() || ""
      }

      // Clean up content
      mainContent = mainContent
        .replace(/\s+/g, " ")
        .replace(/\n+/g, "\n")
        .replace(/[^\w\s.,?!;:()"'-]/g, " ")
        .replace(/[.]{2,}/g, "...")
        .replace(/[!]{2,}/g, "!")
        .replace(/[?]{2,}/g, "?")
        .replace(/https?:\/\/[^\s]+/g, "")
        .replace(/&[a-z]+;/g, " ")
        .replace(/([.,!?;:])\s*([A-Za-z])/g, "$1 $2")
        .trim()

      return {
        title,
        content: mainContent,
        description,
        author,
        date: datePublished,
      }
    } catch (error) {
      console.error("❌ Error during scraping:", error)
      throw error
    }
  }

  const createInfographicPrompt = (content?: ScrapedContent, customPrompt?: string): string => {
    let prompt = `Create a professional, visually appealing infographic:\n\n`

    // Include scraped content if available
    if (content) {
      const { title, content: text, description, author, date } = content
      const truncatedContent = text.length > 4000 ? text.substring(0, 4000) + "..." : text

      prompt += `Based on this blog content:\n\n`
      prompt += `Title: ${title}\n`
      if (description) prompt += `Description: ${description}\n`
      if (author) prompt += `Author: ${author}\n`
      if (date) prompt += `Date: ${date}\n`
      prompt += `\nContent Summary:\n${truncatedContent}\n\n`
    } else {
      prompt += `Based on user-provided instructions.\n\n`
    }

    // Add design requirements
    prompt += `Design Requirements:
- Modern, clean design with a professional color scheme (blues, teals, grays, whites)
- Clear visual hierarchy with the title prominently displayed at the top
- Extract and highlight key points, statistics, and important information as bullet points or callout boxes
- Use icons, charts, graphs, or visual elements to represent data and concepts 
- If suitable, include images, caricatures, or illustrations that enhance understanding
- Include any numbers, percentages, or statistics mentioned in the content
- Create sections or blocks to organize information logically
- Use contrasting colors and typography for better readability , DONT MAKE SPELLING MISTAKES
- Ensure the texts are concise and to the point, avoiding long paragraphs 
- Clean, minimalist design with enough white space not too much and not too little
- Make it visually engaging with proper spacing and layout
- If any company or brand is mentioned, include their logo or branding elements or their name if no logo is available
- Include visual elements like arrows, dividers, or frames to guide the eye
- Ensure all text is large enough to be easily readable
- Use a vertical layout that flows from top to bottom
- Add subtle background elements or patterns for visual interest
- Include call-to-action elements if mentioned in the content
- Make key insights stand out with highlighting or special formatting
- Be Creative , make it visually appealing and engaging
(The content is professional, for awareness, and sometimes on sensitive topics , take these topics as they are just spreading awareness and educating people.)\n`

    // Add custom instructions if provided
    if (customPrompt && customPrompt.trim()) {
      prompt += `\nAdditional Custom Instructions:\n${customPrompt.trim()}\n`
    }

    prompt += `\nStyle: Professional infographic with modern typography, clean layout, engaging visual elements, and a cohesive color scheme that enhances readability and visual appeal.`

    return prompt
  }

  const generateInfographic = async () => {
    // Check if at least one input is provided
    if (!url.trim() && !customPrompt.trim()) {
      setError("Please enter a blog URL or custom prompt")
      return
    }

    setIsGenerating(true)
    setError("")
    setGeneratedInfographic(null)

    try {
      let scrapedContent: ScrapedContent | undefined
      let infographicTitle = "Custom Infographic"
      let sourceUrl = url.trim()

      // Step 1: Scrape the content if URL is provided
      if (url.trim()) {
        setProgress("Scraping blog content...")
        scrapedContent = await scrapeUrl(url.trim())
        if (!scrapedContent.content || scrapedContent.content.length < 100) {
          throw new Error("Unable to extract sufficient content from the URL")
        }
        infographicTitle = scrapedContent.title
      }

      // Step 2: Create infographic prompt
      setProgress("Creating AI prompt...")
      const infographicPrompt = createInfographicPrompt(scrapedContent, customPrompt.trim())

      // Step 3: Generate infographic using Fal AI
      setProgress("Generating infographic with AI...")
      
      const { fal } = await import("@fal-ai/client")
      fal.config({
        credentials: FAL_API_KEY,
      })

      const result = await fal.subscribe("fal-ai/gpt-image-1/text-to-image/byok", {
        input: {
          prompt: infographicPrompt,
          image_size: size as "auto" | "1024x1024" | "1536x1024" | "1024x1536",
          quality: quality as "auto" | "low" | "medium" | "high",
          num_images: 1,
          background: "opaque" as const,
          openai_api_key: OPENAI_API_KEY,
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS") {
            setProgress("AI is generating your infographic...")
          }
        },
      })

      if (!result.data || !result.data.images || result.data.images.length === 0) {
        throw new Error("No image generated")
      }

      const imageUrl = result.data.images[0].url
      setGeneratedInfographic({
        url: imageUrl,
        title: infographicTitle,
        sourceUrl: sourceUrl || "Custom Prompt",
      })

      setProgress("Infographic generated successfully!")
    } catch (error) {
      console.error("Error generating infographic:", error)
      setError(error instanceof Error ? error.message : "Failed to generate infographic")
    } finally {
      setIsGenerating(false)
      setProgress("")
    }
  }

  const addToCanvas = async () => {
    if (!generatedInfographic) return

    try {
      setProgress("Adding to canvas...")
      
      // Fetch the image
      const response = await fetch(generatedInfographic.url)
      const blob = await response.blob()

      // Add image to Adobe Express canvas
      await addOnUISdk.app.document.addImage(blob)
      setProgress("Image added to canvas successfully!")
      
      // Clear progress after 2 seconds
      setTimeout(() => setProgress(""), 2000)
    } catch (error) {
      console.error("Error adding image to canvas:", error)
      setError("Failed to add image to canvas")
    }
  }

  const resetSettings = () => {
    setUrl("")
    setCustomPrompt("")
    setSize("1024x1536")
    setQuality("high")
    setGeneratedInfographic(null)
    setError("")
    setProgress("")
  }

  return (
    <Theme system="express" scale="medium" color="light">
      <div className="container">
        <div className="header">
          <h1>AI Infographic Generator</h1>
          <p>Transform blog posts or custom prompts into stunning infographics</p>
        </div>

        <div className="main-content">
          {/* URL Input Section */}
          <div className="card">
            <h2>Blog URL (Optional)</h2>
            <div className="control">
              <FieldLabel>Enter blog post URL</FieldLabel>
              <Textfield
                value={url}
                onInput={(e: any) => setUrl(e.target.value)}
                placeholder="https://example.com/blog-post"
                disabled={isGenerating}
              />
            </div>
          </div>

          {/* Custom Instructions Section */}
          <div className="card">
            <h2>Custom Instructions (Optional)</h2>
            <div className="control">
              <FieldLabel>Add specific requirements for your infographic</FieldLabel>
              <Textfield
                value={customPrompt}
                onInput={(e: any) => setCustomPrompt(e.target.value)}
                placeholder="Example: Focus on statistics, use green colors, make it social media friendly..."
                disabled={isGenerating}
                rows={3}
              />
            </div>
          </div>

          {/* Settings Section */}
          <div className="card">
            <h2>Settings</h2>
            <div className="control">
              <FieldLabel>Image Size</FieldLabel>
              <Picker
                value={size}
                change={(value: any) => setSize(value)}
                disabled={isGenerating}
              >
                <MenuItem value="1024x1536">Portrait (1024x1536)</MenuItem>
                <MenuItem value="1024x1024">Square (1024x1024)</MenuItem>
                <MenuItem value="1536x1024">Landscape (1536x1024)</MenuItem>
              </Picker>
            </div>
            <div className="control">
              <FieldLabel>Quality</FieldLabel>
              <Picker
                value={quality}
                change={(value: any) => setQuality(value)}
                disabled={isGenerating}
              >
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="low">Low</MenuItem>
              </Picker>
            </div>
          </div>

          {/* Progress/Error Section */}
          {(progress || error) && (
            <div className="card status-card">
              {progress && (
                <div className="progress-section">
                  <ProgressCircle indeterminate size="s" />
                  <p className="progress-text">{progress}</p>
                </div>
              )}
              {error && (
                <div className="error-section">
                  <p className="error-text">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* Preview Section */}
          {generatedInfographic && (
            <div className="card preview-card">
              <h2>Generated Infographic</h2>
              <div className="preview">
                <img
                  src={generatedInfographic.url || "/placeholder.svg"}
                  alt="Generated Infographic"
                  className="preview-image"
                />
              </div>
              <p className="preview-title">Based on: {generatedInfographic.title}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="card">
            <h2>Actions</h2>
            <div className="button-group">
              <Button
                size="m"
                variant="secondary"
                onClick={resetSettings}
                disabled={isGenerating}
              >
                Reset
              </Button>
              <Button
                size="m"
                onClick={generateInfographic}
                disabled={isGenerating || (!url.trim() && !customPrompt.trim())}
              >
                {isGenerating ? "Generating..." : "Generate Infographic"}
              </Button>
              {generatedInfographic && (
                <Button
                  size="m"
                  variant="cta"
                  onClick={addToCanvas}
                  disabled={isGenerating}
                >
                  Add to Canvas
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Theme>
  )
}

export default App