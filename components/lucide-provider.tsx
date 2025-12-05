"use client"

import { useEffect } from "react"
import { DB } from "@/lib/database"
import * as Backend from "@/lib/backend"
import * as UI from "@/lib/frontend"

// Global State
let currentUserData: any = null
let globalSettings: any = { decodePassword: "default" }
let activeTab = "chat"
let authTab = "user"
let loginMode = "login"
let selectedChatUser: any = null
let error = ""
let success = ""
let chatInterval: any = null

// Window Helpers
if (typeof window !== "undefined") {
  ;(window as any).setAuthTab = (tab: string) => {
    authTab = tab
    error = ""
    renderApp()
  }
  ;(window as any).setLoginMode = (mode: string) => {
    loginMode = mode
    error = ""
    success = ""
    renderApp()
  }
  ;(window as any).setActiveTab = (tab: string) => {
    activeTab = tab
    renderApp()
  }
  ;(window as any).handleLogout = () => {
    if (chatInterval) clearInterval(chatInterval)
    currentUserData = null
    activeTab = "chat"
    authTab = "user"
    loginMode = "login"
    selectedChatUser = null
    error = ""
    success = ""
    renderApp()
  }
  ;(window as any).selectUser = (username: string | null) => {
    selectedChatUser = username ? { username } : null
    renderApp()
  }
}

async function handleAuth(type: string, username: string, password: string) {
  renderLoading()
  error = ""
  success = ""

  try {
    if (authTab === "admin") {
      if (username === "admin" && password === "admin123") {
        currentUserData = { username: "Admin", role: "admin", isVerified: true, id: "admin_root" }
        activeTab = "admin"
        await fetchGlobalSettings()
      } else {
        throw new Error("Invalid Admin Credentials")
      }
    } else {
      if (type === "signup") {
        const exists = await DB.checkUsername(username)
        if (exists) throw new Error("Username already taken")

        await DB.createUser({ username, password, role: "user", isVerified: false })
        success = "Account created! Waiting for verification."
        loginMode = "login"
      } else {
        const user = await DB.login(username, password)
        if (!user) throw new Error("Invalid credentials")
        if (!user.isVerified) throw new Error("Account pending verification.")

        currentUserData = user
        activeTab = "chat"
        await fetchGlobalSettings()
      }
    }
  } catch (e: any) {
    console.error(e)
    error = e.message
  }
  renderApp()
}

async function fetchGlobalSettings() {
  try {
    const s = await DB.getSettings()
    if (s) {
      globalSettings = {
        id: s.id,
        _id: s._id || s.id,
        decodePassword: s.decodePassword || "admin_secret",
      }
      console.log("[v0] Global settings loaded:", globalSettings.decodePassword)
    }
  } catch (e) {
    console.warn("Could not fetch settings", e)
  }
}

function renderLoading() {
  const appRoot = document.getElementById("app-root")
  if (appRoot) {
    appRoot.innerHTML = `<div class="flex-1 flex items-center justify-center flex-col gap-4 bg-slate-900"><div class="spinner"></div><p class="text-slate-400 font-mono text-sm">CONNECTING TO DATABASE...</p></div>`
  }
}

function renderApp() {
  const appRoot = document.getElementById("app-root")
  if (!appRoot) return

  if (!currentUserData) {
    appRoot.innerHTML = UI.AuthPage({ loginMode, authTab, error, success })
  } else {
    appRoot.innerHTML = UI.DashboardPage(currentUserData, activeTab)
    renderTabContent()
  }

  if ((window as any).lucide) (window as any).lucide.createIcons()

  const btn = document.getElementById("auth-action-btn")
  if (btn)
    btn.onclick = () => {
      const u = (document.getElementById("u-in") as HTMLInputElement).value.trim()
      const p = (document.getElementById("p-in") as HTMLInputElement).value.trim()
      if (!u || !p) {
        error = "All fields required"
        renderApp()
        return
      }
      handleAuth(loginMode === "login" || authTab === "admin" ? "login" : "signup", u, p)
    }
}

function renderTabContent() {
  const c = document.getElementById("tab-content")
  if (!c) return
  c.innerHTML = ""

  if (activeTab === "chat") renderPrivateChat(c)
  else if (activeTab === "downloads") renderDownloads(c)
  else if (activeTab === "classifier") renderClassifier(c)
  else if (activeTab === "decode") renderDecoder(c)
  else if (activeTab === "encode" && currentUserData.role === "admin") renderEncode(c)
  else if (activeTab === "admin" && currentUserData.role === "admin") renderAdminControls(c)

  if ((window as any).lucide) (window as any).lucide.createIcons()
}

async function renderPrivateChat(container: HTMLElement) {
  if (chatInterval) {
    clearInterval(chatInterval)
    chatInterval = null
  }

  container.innerHTML = `
    <div class="flex h-full w-full pb-16 md:pb-0">
      <div class="w-80 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 transition-all ${selectedChatUser ? "hidden md:flex" : "flex w-full"}">
        <div class="p-4 border-b border-slate-800">
          <h2 class="font-bold text-white text-lg">Communications</h2>
          <p class="text-xs text-slate-400 mt-1">Select a verified channel</p>
        </div>
        <div id="users-list" class="flex-1 overflow-y-auto p-2 space-y-1">
          <div class="flex items-center justify-center h-40 text-slate-500"><div class="spinner w-6 h-6 border-slate-600 border-t-blue-500"></div></div>
        </div>
      </div>
      <div class="flex-1 flex flex-col bg-slate-950 ${!selectedChatUser ? "hidden md:flex" : "flex w-full"}">
        ${UI.renderChatTemplate(selectedChatUser, [], currentUserData)}
      </div>
    </div>`

  const list = document.getElementById("users-list")
  if (list) {
    let users = await DB.getVerifiedUsers()
    users = users.filter((u: any) => u.username !== currentUserData.username)

    const adminUser = { username: "Admin", role: "admin", isVerified: true }
    if (currentUserData.role === "user" && !users.some((u: any) => u.username === "Admin")) {
      users.unshift(adminUser)
    }

    if (users.length === 0) {
      list.innerHTML = `<div class="p-4 text-center text-sm text-slate-500 border border-dashed border-slate-800 rounded mx-4 mt-4">No verified contacts.</div>`
    } else {
      list.innerHTML = users
        .map(
          (u: any) => `
        <div onclick="window.selectUser('${u.username}')" class="user-item p-3 rounded-lg cursor-pointer flex items-center gap-3 border-l-4 border-transparent ${selectedChatUser?.username === u.username ? "active bg-slate-800 border-blue-500" : "hover:bg-slate-800/50"}">
          <div class="w-10 h-10 rounded-full ${u.role === "admin" || u.username === "Admin" ? "bg-amber-500/10 text-amber-500 border border-amber-500/30" : "bg-slate-800 text-slate-300 border border-slate-700"} flex items-center justify-center font-bold text-sm">
            ${u.username.charAt(0).toUpperCase()}
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-medium text-slate-200 truncate flex items-center gap-2">
              ${u.username} ${u.role === "admin" || u.username === "Admin" ? '<span class="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-bold">HQ</span>' : ""}
            </div>
          </div>
        </div>`,
        )
        .join("")
    }
  }

  if (selectedChatUser) {
    const chatId = [currentUserData.username, selectedChatUser.username].sort().join("_")

    const refreshChat = async () => {
      const msgs = await DB.getMessages(chatId)
      const rightCol = container.querySelector(".flex-1.flex.flex-col.bg-slate-950")
      if (rightCol) {
        const msgDiv = document.getElementById("chat-messages")
        const isAtBottom = msgDiv ? msgDiv.scrollHeight - msgDiv.scrollTop <= msgDiv.clientHeight + 50 : true

        const textInput = document.getElementById("text-input") as HTMLTextAreaElement
        const savedValue = textInput?.value || ""
        const savedSelectionStart = textInput?.selectionStart || 0
        const savedSelectionEnd = textInput?.selectionEnd || 0
        const wasFocused = document.activeElement === textInput

        rightCol.innerHTML = UI.renderChatTemplate(selectedChatUser, msgs, currentUserData)
        setupForm(handleSend)

        const newTextInput = document.getElementById("text-input") as HTMLTextAreaElement
        if (newTextInput && savedValue) {
          newTextInput.value = savedValue
          if (wasFocused) {
            newTextInput.focus()
            newTextInput.setSelectionRange(savedSelectionStart, savedSelectionEnd)
          }
          // Restore height
          newTextInput.style.height = "40px"
          newTextInput.style.height = Math.min(newTextInput.scrollHeight, 120) + "px"
        }

        const newMsgDiv = document.getElementById("chat-messages")
        if (newMsgDiv && isAtBottom) {
          newMsgDiv.scrollTop = newMsgDiv.scrollHeight
        }
      }
    }

    const handleSend = async (text: string, imgUrl: string | null = null) => {
      await DB.sendMessage({
        chatId,
        text: text || (imgUrl ? "Image" : ""),
        sender: currentUserData.username,
        timestamp: Date.now(),
        type: imgUrl ? "image" : "text",
        imageUrl: imgUrl,
      })
      await refreshChat()
    }

    await refreshChat()
    chatInterval = setInterval(refreshChat, 3000)
    setupForm(handleSend)
  }
}

function setupForm(handleSend: Function) {
  const f = document.getElementById("chat-form") as HTMLFormElement
  if (f)
    f.onsubmit = (e: Event) => {
      e.preventDefault()
      const t = (document.getElementById("text-input") as HTMLTextAreaElement).value.trim()
      if (t) {
        handleSend(t)
        ;(document.getElementById("text-input") as HTMLTextAreaElement).value = ""
        const textarea = document.getElementById("text-input") as HTMLTextAreaElement
        if (textarea) textarea.style.height = "40px"
      }
    }
  const i = document.getElementById("img-input") as HTMLInputElement
  if (i)
    i.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const r = new FileReader()
        r.onload = (evt: ProgressEvent<FileReader>) =>
          Backend.handleResizeAndSend(evt.target?.result as string, handleSend)
        r.readAsDataURL(file)
      }
    }

  const textarea = document.getElementById("text-input") as HTMLTextAreaElement
  if (textarea) {
    textarea.addEventListener("input", () => {
      textarea.style.height = "40px"
      const scrollHeight = textarea.scrollHeight
      textarea.style.height = Math.min(scrollHeight, 120) + "px"
    })
  }
}

async function renderDownloads(c: HTMLElement) {
  c.innerHTML = `<div class="p-8 max-w-6xl mx-auto"><div class="flex items-center justify-between mb-8"><div><h2 class="text-2xl font-bold text-white">Public Gallery</h2><p class="text-slate-400 text-sm">Artifacts published by HQ.</p></div></div><div id="gallery-grid" class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6"><div class="col-span-full py-20 text-center text-slate-500">Loading...</div></div></div>`

  const items = await DB.getGallery()
  const g = document.getElementById("gallery-grid")
  if (!g) return

  g.innerHTML = items.length
    ? items
        .map(
          (i: any) =>
            `<div class="group bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-blue-500/50 transition-all"><div class="h-48 bg-slate-900 relative overflow-hidden flex items-center justify-center"><img src="${i.imageUrl}" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"><div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><a href="${i.imageUrl}" download="stego_${i.timestamp}.png" class="bg-blue-600 text-white px-4 py-2 rounded-full font-bold text-xs flex items-center gap-2 hover:bg-blue-500">${UI.renderIcon("Download")} DOWNLOAD</a></div></div><div class="p-4"><div class="font-bold text-slate-200 truncate">${i.title || "Artifact"}</div><div class="text-xs text-slate-500 mt-1">${new Date(i.timestamp).toLocaleDateString()}</div></div></div>`,
        )
        .join("")
    : '<div class="col-span-full text-center text-slate-500 py-10">No public artifacts found.</div>'
}

function renderClassifier(c: HTMLElement) {
  c.innerHTML = `<div class="p-8 max-w-2xl mx-auto text-center"><h2 class="text-2xl font-bold text-white mb-2">AI Steganalysis</h2><p class="text-slate-400 mb-8">Statistical anomaly detection system.</p><div class="bg-slate-800/50 rounded-2xl border border-slate-700 p-8"><input type="file" id="cl-f" class="hidden" accept="image/*" /><label for="cl-f" class="cursor-pointer flex flex-col items-center gap-4 py-10 border-2 border-dashed border-slate-600 rounded-xl hover:bg-slate-700/50 hover:border-blue-500 transition-colors"><div class="w-16 h-16 bg-slate-700 text-blue-400 rounded-full flex items-center justify-center">${UI.renderIcon("Scan", "w-8 h-8")}</div><div class="text-center"><p class="font-bold text-slate-300">Initialize Scan</p><p class="text-xs text-slate-500 mt-1">Upload Image (PNG recommended)</p></div></label><div id="cl-r" class="hidden mt-6 pt-6 border-t border-slate-700"></div></div></div>`

  const clf = document.getElementById("cl-f") as HTMLInputElement
  if (clf)
    clf.onchange = (e: Event) => {
      const f = (e.target as HTMLInputElement).files?.[0]
      if (!f) return
      const i = new Image()
      i.crossOrigin = "anonymous"
      i.src = URL.createObjectURL(f)
      const r = document.getElementById("cl-r")!
      r.classList.remove("hidden")
      r.innerHTML = '<span class="text-blue-400 animate-pulse">ANALYZING...</span>'

      i.onload = () => {
        const cv = document.createElement("canvas")
        cv.width = i.width
        cv.height = i.height
        const ctx = cv.getContext("2d")!
        ctx.drawImage(i, 0, 0)
        const img = ctx.getImageData(0, 0, cv.width, cv.height)

        const totalPixels = cv.width * cv.height
        const stride = totalPixels > 2_000_000 ? 2 : 1
        const { gray, width, height } = Backend.rgbaToGrayscale(img.data, cv.width, cv.height, stride)

        const sChi = Backend.chiSquareLSBScore(gray)
        const sRS = Backend.rsFlipScore(gray, width, height)
        const sCorr = Backend.correlationDropScore(gray, width, height)
        const sHist = Backend.lsbHistogramScore(gray)

        // Chi-square: 35%, RS: 30%, Correlation: 20%, Histogram: 15%
        const prob = Backend.clamp01(0.35 * sChi + 0.3 * sRS + 0.2 * sCorr + 0.15 * sHist)

        const isStego = prob >= 0.45

        r.innerHTML = `<div class="flex flex-col items-center">
          <div class="w-16 h-16 rounded-full flex items-center justify-center mb-3 ${isStego ? "bg-red-500/10 text-red-500" : "bg-green-500/10 text-green-500"}">
            ${UI.renderIcon(isStego ? "AlertTriangle" : "CheckCircle", "w-8 h-8")}
          </div>
          <h3 class="text-xl font-bold ${isStego ? "text-red-400" : "text-green-400"}">
            ${isStego ? "ANOMALY DETECTED" : "CLEAN"}
          </h3>
          <p class="text-xs text-slate-500 mt-1">CONFIDENCE: ${(prob * 100).toFixed(1)}%</p>
          <div class="mt-4 grid grid-cols-2 gap-2 text-[10px] text-slate-500 font-mono w-full max-w-xs">
            <div class="bg-slate-800 rounded p-2">
              <div class="text-slate-400 mb-1">Chi-Square</div>
              <div class="${sChi > 0.5 ? "text-red-400" : "text-green-400"}">${(sChi * 100).toFixed(0)}%</div>
            </div>
            <div class="bg-slate-800 rounded p-2">
              <div class="text-slate-400 mb-1">RS Analysis</div>
              <div class="${sRS > 0.5 ? "text-red-400" : "text-green-400"}">${(sRS * 100).toFixed(0)}%</div>
            </div>
            <div class="bg-slate-800 rounded p-2">
              <div class="text-slate-400 mb-1">Correlation</div>
              <div class="${sCorr > 0.5 ? "text-red-400" : "text-green-400"}">${(sCorr * 100).toFixed(0)}%</div>
            </div>
            <div class="bg-slate-800 rounded p-2">
              <div class="text-slate-400 mb-1">LSB Histogram</div>
              <div class="${sHist > 0.5 ? "text-red-400" : "text-green-400"}">${(sHist * 100).toFixed(0)}%</div>
            </div>
          </div>
        </div>`
      }
    }
}

function renderDecoder(c: HTMLElement) {
  c.innerHTML = `<div class="p-8 max-w-xl mx-auto"><div class="bg-slate-800/50 rounded-2xl border border-slate-700 p-6"><h2 class="text-xl font-bold text-white mb-6 flex items-center gap-2">${UI.renderIcon("Unlock")} Decryption Module</h2><div class="space-y-4"><div><label class="text-[10px] font-bold text-slate-500 uppercase">Global Key</label><input type="password" id="dec-pass" class="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white focus:border-blue-500 outline-none"></div><div><label class="text-[10px] font-bold text-slate-500 uppercase">Source Image (PNG for best results)</label><input type="file" id="dec-in" accept="image/*" class="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-500"/></div><button id="dec-btn" class="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded font-bold text-sm">EXECUTE DECRYPT</button></div><div id="dec-out" class="mt-6 hidden p-4 rounded bg-slate-900 border border-slate-700 text-sm font-mono break-all text-slate-300"></div></div></div>`

  const decBtn = document.getElementById("dec-btn")
  if (decBtn)
    decBtn.onclick = async () => {
      const p = (document.getElementById("dec-pass") as HTMLInputElement).value
      const f = (document.getElementById("dec-in") as HTMLInputElement).files?.[0]
      const o = document.getElementById("dec-out")!
      if (!p || !f) return

      await fetchGlobalSettings()
      console.log("[v0] Decode attempt - entered key:", p, "expected key:", globalSettings.decodePassword)

      if (p !== globalSettings.decodePassword) {
        o.innerHTML = '<span class="text-red-500">INVALID KEY</span>'
        o.classList.remove("hidden")
        return
      }

      const i = new Image()
      i.crossOrigin = "anonymous"
      i.src = URL.createObjectURL(f)
      i.onload = () => {
        const cv = document.createElement("canvas")
        cv.width = i.width
        cv.height = i.height
        const ctx = cv.getContext("2d")!
        ctx.drawImage(i, 0, 0, i.width, i.height)
        const d = ctx.getImageData(0, 0, cv.width, cv.height).data

        console.log("[v0] Decoding image dimensions:", cv.width, "x", cv.height, "pixels:", d.length / 4)

        let bits = ""
        const chars: string[] = []

        // Extract LSBs from RGB channels (skip Alpha)
        for (let j = 0; j < d.length; j += 4) {
          for (let k = 0; k < 3; k++) {
            bits += (d[j + k] & 1).toString()

            // Every 8 bits, convert to character
            if (bits.length === 8) {
              const charCode = Number.parseInt(bits, 2)
              // Stop if we hit null terminator
              if (charCode === 0) {
                const message = chars.join("")
                console.log("[v0] Found null terminator, message length:", message.length)
                const endMarker = message.indexOf("###END###")
                o.innerHTML =
                  endMarker !== -1
                    ? `<span class="text-green-400">DECRYPTED:</span><br>${message.substring(0, endMarker)}`
                    : '<span class="text-amber-500">NO DATA FOUND</span>'
                o.classList.remove("hidden")
                return
              }
              chars.push(String.fromCharCode(charCode))
              bits = ""

              // Check for end marker periodically to avoid processing entire image
              if (chars.length % 50 === 0) {
                const partial = chars.join("")
                if (partial.includes("###END###")) {
                  const endIdx = partial.indexOf("###END###")
                  console.log("[v0] Found end marker at position:", endIdx)
                  o.innerHTML = `<span class="text-green-400">DECRYPTED:</span><br>${partial.substring(0, endIdx)}`
                  o.classList.remove("hidden")
                  return
                }
              }
            }
          }
        }

        // Final check after processing all pixels
        const message = chars.join("")
        console.log("[v0] Finished processing, extracted chars:", chars.length)
        const endMarker = message.indexOf("###END###")
        o.innerHTML =
          endMarker !== -1
            ? `<span class="text-green-400">DECRYPTED:</span><br>${message.substring(0, endMarker)}`
            : '<span class="text-amber-500">NO DATA FOUND - Image may be compressed or not encoded</span>'
        o.classList.remove("hidden")
      }
    }
}

async function renderEncode(c: HTMLElement) {
  c.innerHTML = `<div class="p-8 max-w-xl mx-auto"><div class="bg-slate-800/50 p-6 rounded-2xl border border-slate-700"><h2 class="font-bold text-white text-lg mb-4">Encoder Station</h2><div class="space-y-4"><input type="file" id="enc-f" accept="image/*" class="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-500"><p class="text-xs text-amber-400">Any image format accepted. Output will be PNG to preserve hidden data.</p><textarea id="enc-m" class="w-full bg-slate-900 border border-slate-600 rounded p-3 text-sm text-white" rows="3" placeholder="Secret payload..."></textarea><button id="enc-btn" class="bg-blue-600 hover:bg-blue-500 text-white w-full py-2.5 rounded font-bold text-sm">ENCODE & PUBLISH</button></div><div id="enc-stat" class="mt-4 text-center text-xs font-mono text-slate-400"></div></div></div>`

  const encBtn = document.getElementById("enc-btn")
  if (encBtn)
    encBtn.onclick = async () => {
      const stat = document.getElementById("enc-stat")
      const f = (document.getElementById("enc-f") as HTMLInputElement).files?.[0]
      const m = (document.getElementById("enc-m") as HTMLTextAreaElement).value

      if (!f || !m) {
        if (stat) stat.innerHTML = '<span class="text-red-400">Please select an image and enter a message.</span>'
        return
      }

      if (stat) stat.innerHTML = '<span class="text-blue-400">Processing...</span>'

      const img = new Image()
      img.crossOrigin = "anonymous"
      img.src = URL.createObjectURL(f)

      img.onload = async () => {
        try {
          const cv = document.createElement("canvas")
          const w = img.width,
            h = img.height
          cv.width = w
          cv.height = h
          const ctx = cv.getContext("2d")!
          ctx.drawImage(img, 0, 0, w, h)
          const imgData = ctx.getImageData(0, 0, w, h)
          const d = imgData.data

          const msg = m + "###END###" + "\0"
          let bin = ""
          for (let i = 0; i < msg.length; i++) {
            bin += msg.charCodeAt(i).toString(2).padStart(8, "0")
          }

          const maxBits = (d.length / 4) * 3
          if (bin.length > maxBits) {
            if (stat) stat.innerHTML = '<span class="text-red-400">Message too long for this image.</span>'
            return
          }

          console.log("[v0] Encoding message, binary length:", bin.length, "max capacity:", maxBits)

          let bitIdx = 0
          for (let i = 0; i < d.length; i += 4) {
            for (let j = 0; j < 3; j++) {
              if (bitIdx < bin.length) {
                if (bin[bitIdx] === "1") {
                  d[i + j] = d[i + j] | 1
                } else {
                  d[i + j] = d[i + j] & 0xfe
                }
                bitIdx++
              } else {
                d[i + j] = d[i + j] & 0xfe
              }
            }
          }

          ctx.putImageData(imgData, 0, 0)
          console.log("[v0] Encoding complete, bits embedded:", bitIdx)

          cv.toBlob(async (b) => {
            if (!b) {
              if (stat) stat.innerHTML = '<span class="text-red-400">Failed to create image blob.</span>'
              return
            }

            try {
              if (stat) stat.innerHTML = '<span class="text-blue-400">Uploading...</span>'

              const form = new FormData()
              form.append("file", b, "stego.png")

              const res = await fetch("/api/upload", { method: "POST", body: form })

              if (!res.ok) {
                const err = await res.json()
                console.error("[v0] Upload failed:", err)
                if (stat)
                  stat.innerHTML = `<span class="text-red-400">Upload failed: ${err.error || "Unknown error"}</span>`
                return
              }

              const { url } = await res.json()
              console.log("[v0] Image uploaded successfully, URL length:", url?.length)

              await DB.addToGallery({
                imageUrl: url,
                title: `Encoded ${new Date().toLocaleTimeString()}`,
                timestamp: new Date().toISOString(),
              })

              if (stat) stat.innerHTML = '<span class="text-green-400">SUCCESS! Image uploaded to gallery.</span>'
            } catch (uploadErr) {
              console.error("[v0] Upload error:", uploadErr)
              if (stat) stat.innerHTML = `<span class="text-red-400">Upload error: ${uploadErr}</span>`
            }
          }, "image/png")
        } catch (encodeErr) {
          console.error("[v0] Encode error:", encodeErr)
          if (stat) stat.innerHTML = `<span class="text-red-400">Encode error: ${encodeErr}</span>`
        }
      }

      img.onerror = () => {
        if (stat) stat.innerHTML = '<span class="text-red-400">Failed to load image.</span>'
      }
    }
}

async function renderAdminControls(c: HTMLElement) {
  await fetchGlobalSettings()

  c.innerHTML = `<div class="p-6 grid md:grid-cols-2 gap-6"><div class="bg-slate-800/50 p-6 rounded-xl border border-slate-700"><h3 class="font-bold text-white mb-4 flex gap-2">${UI.renderIcon("Shield")} Pending Verification</h3><div id="adm-list" class="space-y-2 text-sm">Loading...</div></div><div class="bg-slate-800/50 p-6 rounded-xl border border-slate-700 h-fit"><h3 class="font-bold text-white mb-4 flex gap-2">${UI.renderIcon("Key")} Security Config</h3><input id="gk-in" class="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white mb-3" placeholder="New Global Key" value="${globalSettings.decodePassword || ""}"><button id="gk-save" class="bg-blue-600 hover:bg-blue-500 text-white w-full py-2 rounded text-sm font-bold">UPDATE KEY</button></div></div>`

  const refreshList = async () => {
    const l = document.getElementById("adm-list")
    if (!l) return
    const users = await DB.getUnverifiedUsers()
    l.innerHTML = users.length
      ? users
          .map(
            (x: any) =>
              `<div class="flex justify-between items-center p-3 bg-slate-900 rounded border border-slate-700"><span class="font-mono text-slate-300">${x.username}</span><button onclick="window.verify('${x.id}')" class="text-[10px] font-bold bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded">APPROVE</button></div>`,
          )
          .join("")
      : '<p class="text-slate-500">No pending requests.</p>'
  }
  ;(window as any).verify = async (id: string) => {
    await DB.verifyUser(id)
    refreshList()
  }

  const gkSave = document.getElementById("gk-save")
  if (gkSave)
    gkSave.onclick = async () => {
      const v = (document.getElementById("gk-in") as HTMLInputElement).value
      if (v) {
        await DB.updateSettings(globalSettings.id || globalSettings._id, v)
        globalSettings.decodePassword = v
        console.log("[v0] Global key updated to:", v)
        alert("Global key saved successfully!")
      }
    }

  refreshList()
}

export default function LucideProvider() {
  useEffect(() => {
    async function initApp() {
      renderApp()
      ;(window as any).setAuthTab = (tab: string) => {
        authTab = tab
        error = ""
        renderApp()
      }
      ;(window as any).setLoginMode = (mode: string) => {
        loginMode = mode
        error = ""
        success = ""
        renderApp()
      }
      ;(window as any).setActiveTab = (tab: string) => {
        activeTab = tab
        renderApp()
      }
      ;(window as any).handleLogout = () => {
        if (chatInterval) clearInterval(chatInterval)
        currentUserData = null
        activeTab = "chat"
        authTab = "user"
        loginMode = "login"
        selectedChatUser = null
        error = ""
        success = ""
        renderApp()
      }
      ;(window as any).selectUser = (username: string | null) => {
        selectedChatUser = username ? { username } : null
        renderApp()
      }
      ;(window as any).verify = async (id: string) => {
        await DB.verifyUser(id)
      }
    }
    initApp()

    const script = document.createElement("script")
    script.src = "https://unpkg.com/lucide@latest"
    script.async = true
    document.body.appendChild(script)
  }, [])

  return <div id="app-root" className="min-h-screen flex flex-col bg-slate-950"></div>
}
