const appId = "stego-live-v1"

export const DB = {
  async checkUsername(username: string) {
    try {
      const response = await fetch("/api/auth/check-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      })
      const data = await response.json()
      return data.exists || false
    } catch (error) {
      console.error("Check username failed:", error)
      return false
    }
  },

  async createUser(userData: any) {
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Registration failed")
      }
      return await response.json()
    } catch (error) {
      console.error("Create user failed:", error)
      throw error
    }
  },

  async login(username: string, password: string) {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })

      if (!response.ok) {
        const err = await response.json()
        console.log("[v0] Login error:", err)
        return null
      }

      const data = await response.json()
      console.log("[v0] Login response:", data)

      if (data.user) {
        return {
          ...data.user,
          isVerified: data.user.isverified === true || data.user.isverified === 1,
        }
      }
      return null
    } catch (error) {
      console.error("Login failed:", error)
      return null
    }
  },

  async sendMessage(msgData: any) {
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: msgData.chatId,
          text: msgData.text || "",
          sender: msgData.sender,
          timestamp: msgData.timestamp,
          type: msgData.type || "text",
          imageUrl: msgData.imageUrl || null,
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        console.error("[v0] Send message error:", err)
        throw new Error("Send message failed")
      }
      const result = await response.json()
      return {
        ...result,
        chatId: result.chatid,
        imageUrl: result.imageurl,
      }
    } catch (error) {
      console.error("Send message failed:", error)
      throw error
    }
  },

  async getMessages(chatId: string) {
    try {
      const response = await fetch(`/api/messages?chatId=${encodeURIComponent(chatId)}`)
      if (!response.ok) {
        console.error("[v0] Get messages failed:", response.status)
        throw new Error("Get messages failed")
      }
      const messages = await response.json()
      // Map lowercase DB columns to camelCase for frontend
      return messages.map((msg: any) => ({
        id: msg.id,
        chatId: msg.chatid || msg.chatId,
        text: msg.text,
        sender: msg.sender,
        timestamp: msg.timestamp,
        type: msg.type || "text",
        imageUrl: msg.imageurl || msg.imageUrl,
        created_at: msg.created_at,
      }))
    } catch (error) {
      console.error("Get messages failed:", error)
      return []
    }
  },

  async getGallery() {
    try {
      const response = await fetch("/api/gallery")
      if (!response.ok) throw new Error("Get gallery failed")
      const items = await response.json()
      return items.map((item: any) => ({
        ...item,
        imageUrl: item.imageurl,
      }))
    } catch (error) {
      console.error("Get gallery failed:", error)
      return []
    }
  },

  async addToGallery(item: any) {
    try {
      const response = await fetch("/api/gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: item.imageUrl,
          title: item.title,
          timestamp: item.timestamp,
        }),
      })

      if (!response.ok) throw new Error("Add to gallery failed")
      return await response.json()
    } catch (error) {
      console.error("Add to gallery failed:", error)
      throw error
    }
  },

  async getSettings() {
    try {
      const response = await fetch("/api/settings")
      if (!response.ok) throw new Error("Get settings failed")
      const data = await response.json()
      console.log("[v0] Settings fetched from API:", data)
      return {
        id: data.id,
        _id: data.id,
        decodePassword: data.decodepassword || data.decodePassword || "admin_secret",
      }
    } catch (error) {
      console.error("Get settings failed:", error)
      return { id: 1, _id: 1, decodePassword: "admin_secret" }
    }
  },

  async updateSettings(id: string, newPass: string) {
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decode_password: newPass }),
      })

      if (!response.ok) throw new Error("Update settings failed")
      return await response.json()
    } catch (error) {
      console.error("Update settings failed:", error)
      throw error
    }
  },

  async getUnverifiedUsers() {
    try {
      const response = await fetch("/api/approval-requests")
      if (!response.ok) throw new Error("Get approval requests failed")
      const data = await response.json()
      return Array.isArray(data) ? data : []
    } catch (error) {
      console.error("Get approval requests failed:", error)
      return []
    }
  },

  async getVerifiedUsers() {
    try {
      const response = await fetch("/api/users/verified")
      if (!response.ok) throw new Error("Get verified users failed")
      return await response.json()
    } catch (error) {
      console.error("Get verified users failed:", error)
      return []
    }
  },

  async verifyUser(userId: string) {
    try {
      const response = await fetch("/api/admin/approval-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: userId, action: "approve" }),
      })
      if (!response.ok) {
        throw new Error("Verification failed")
      }
      return await response.json()
    } catch (error) {
      console.error("Verify user failed:", error)
      throw error
    }
  },
}
