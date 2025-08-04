// ✅ Fixed Chat.js with proper cleanup and initialization
(function () {
  'use strict';

  console.log("📦 Chat.js loading...");

  // ✅ Clear any existing chat-related globals to prevent conflicts
  if (window.ChatApp) {
    console.log("🧹 Cleaning up existing ChatApp instance");
    if (window.ChatApp.socket) {
      window.ChatApp.socket.disconnect();
    }
    delete window.ChatApp;
  }

  // ✅ Initialize socket connection only once
  if (!window.ChatGlobals) {
    const API_URL = "http://localhost:5000/api";
    const socket = io(API_URL.replace("/api", ""), {
      withCredentials: true,
      auth: { token: localStorage.getItem("token") }
    });

    window.ChatGlobals = {
      API_URL,
      socket,
      initialized: true
    };
    console.log("🌐 Chat globals initialized");
  }

  // ✅ Chat application state and functions
  const ChatApp = {
    currentChatId: localStorage.getItem("chatId"),
    currentUser: null,
    receiverInput: { chatId: null, receiverId: null },
    isTyping: false,
    typingTimeout: null,

    // DOM elements (will be set during init)
    elements: {},

    async init() {
      console.log("🚀 Initializing ChatApp...");

      // Get DOM elements
      this.elements = {
        userDropdown: document.getElementById("userDropdown"),
        messageContainer: document.getElementById("messageContainer"),
        msgInput: document.getElementById("msgInput"),
        sendBtn: document.getElementById("sendBtn"),
        deleteChatsBtn: document.getElementById("deleteChatsBtn"),
        chatHeader: document.getElementById("chatHeader"),
        typingIndicator: document.getElementById("typingIndicator"),
        imageInput: document.getElementById('imageInput'),
        imageButton: document.getElementById('imageButton')
      };

      // Check if required elements exist
      if (!this.elements.userDropdown || !this.elements.messageContainer) {
        console.error("❌ Required DOM elements not found");
        return;
      }

      // Set up event listeners
      this.setupEventListeners();
      this.setupSocketListeners();

      // Initialize chat data
      await this.getCurrentUser();
      await this.loadUsers();

      if (this.currentChatId) {
        console.log("📥 Joining chat:", this.currentChatId);
        window.ChatGlobals.socket.emit("joinChat", this.currentChatId);
        await this.loadMessages();
      }

      console.log("✅ ChatApp initialized successfully");
    },

    setupEventListeners() {
      const { userDropdown, sendBtn, deleteChatsBtn, msgInput, imageButton, imageInput, messageContainer } = this.elements;

      // User selection
      userDropdown.addEventListener("change", (e) => this.createOrSwitchChat(e.target.value));

      // Send message
      sendBtn.addEventListener("click", () => this.sendMessage());
      msgInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") this.sendMessage();
      });

      // Delete chats
      if (deleteChatsBtn) {
        deleteChatsBtn.addEventListener("click", () => this.softDeleteChatsForCurrentUser());
      }

      // Image upload
      if (imageButton && imageInput) {
        imageButton.addEventListener('click', () => imageInput.click());
        imageInput.addEventListener('change', () => this.handleImageUpload());
      }

      // Typing indicator
      msgInput.addEventListener("input", () => this.handleTyping());

      // Image download and preview
      messageContainer.addEventListener('click', (event) => this.handleMessageContainerClick(event));
    },

    setupSocketListeners() {
      const socket = window.ChatGlobals.socket;

      socket.on("receiveMessage", (msg) => {
        console.log("📩 Received new message:", msg);
        if (msg.chat?._id === this.currentChatId) {
          this.displayMessage(msg);
          this.scrollToBottom();
        }
      });

      socket.on("message-read-by", ({ messageId, userId }) => {
        const el = document.querySelector(`[data-id='${messageId}']`);
        if (el && this.currentUser && userId === this.receiverInput.receiverId) {
          const tickSpan = el.querySelector(".tick");
          if (tickSpan) {
            tickSpan.innerHTML = '<i class="bi bi-check2-all text-primary"></i>';
          }
        }
      });

      socket.on("message-deleted", (id) => {
        console.log("🗑️ Message deleted:", id);
        const el = document.querySelector(`[data-id='${id}']`);
        if (el) el.remove();
      });

      socket.on("userTyping", ({ chatId, name }) => {
        console.log("✏️ Received userTyping:", { chatId, name });
        if (chatId === this.currentChatId && name) {
          this.elements.typingIndicator.innerText = `${name} is typing...`;
          this.elements.typingIndicator.style.display = "block";
        }
      });

      socket.on("userStopTyping", ({ chatId }) => {
        console.log("🛑 Received userStopTyping:", { chatId });
        if (chatId === this.currentChatId) {
          this.elements.typingIndicator.innerText = "";
          this.elements.typingIndicator.style.display = "none";
        }
      });
    },

    async getCurrentUser() {
      try {
        const res = await fetch(`${window.ChatGlobals.API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });

        if (!res.ok) {
          console.error("❌ Failed to get current user:", res.status);
          window.location.href = "/login.html";
          return;
        }

        this.currentUser = await res.json();
        console.log("👤 Current user:", this.currentUser);
        this.updateChatHeader();
      } catch (err) {
        console.error("❌ Error getting current user:", err);
      }
    },

    async loadUsers() {
      try {
        console.log("📡 Fetching users...");
        const res = await fetch(`${window.ChatGlobals.API_URL}/users`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`❌ Server responded with ${res.status}: ${errText}`);
        }

        const users = await res.json();
        console.log("👥 Loaded users:", users);

        this.elements.userDropdown.innerHTML = `<option disabled selected>-- Select a user --</option>`;
        users.forEach(u => {
          if (u._id !== this.currentUser._id) {
            const opt = document.createElement("option");
            opt.value = u._id;
            opt.textContent = u.name;
            this.elements.userDropdown.appendChild(opt);
          }
        });
      } catch (err) {
        console.error("❌ Error loading users:", err);
        this.elements.userDropdown.innerHTML = `<option disabled selected>Failed to load users</option>`;
      }
    },

    updateChatHeader(otherUserName = "") {
      this.elements.chatHeader.innerText = `Chat - Logged in as: ${this.currentUser?.name || ""}${otherUserName ? ` | Chatting with: ${otherUserName}` : ""}`;
    },

   async createOrSwitchChat(otherId) {
  try {
    const res = await fetch(`${window.ChatGlobals.API_URL}/chats`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`
      },
      body: JSON.stringify({ userId: otherId })
    });

    if (!res.ok) {
      const errorMsg = await res.text();
      throw new Error(`❌ Failed to create/switch chat: ${res.status} ${errorMsg}`);
    }

    const chat = await res.json();

    if (!chat || !chat._id) {
      throw new Error("❌ Chat creation response is invalid.");
    }

    this.currentChatId = chat._id;
    this.receiverInput.chatId = chat._id;
    this.receiverInput.receiverId = otherId;
    localStorage.setItem("chatId", chat._id);

    console.log("🔄 Switched to chat:", this.currentChatId);
    window.ChatGlobals.socket.emit("joinChat", this.currentChatId);

    const selectedOption = this.elements.userDropdown.options[this.elements.userDropdown.selectedIndex];
    this.updateChatHeader(selectedOption.textContent);

    await this.loadMessages();

  } catch (err) {
    console.error("❌ Error creating/switching chat:", err);
    alert(err.message);
  }
},

    async loadMessages() {
      try {
        const res = await fetch(`${window.ChatGlobals.API_URL}/messages/${this.currentChatId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });

        const msgs = await res.json();
        this.elements.messageContainer.innerHTML = "";
        msgs.forEach(msg => this.displayMessage(msg));
        this.scrollToBottom();
      } catch (err) {
        console.error("❌ Error loading messages:", err);
      }
    },

    displayMessage(msg) {
      const div = document.createElement("div");
      const isMine = msg.sender._id === this.currentUser._id;

     div.className = `message p-2 rounded mb-2 ${isMine ? 'text-light align-self-end text-end' : 'text-light align-self-start text-start'}`;
      div.dataset.id = msg._id;

      const name = msg.sender.name;
      const ts = this.formatTime(msg.createdAt);

      let ticks = "";
      if (isMine) {
        if (msg.readBy && msg.readBy.includes(this.receiverInput.receiverId)) {
          ticks = '<i class="bi bi-check2-all text-primary"></i>'; // Blue double tick for read
        } else {
          ticks = '<i class="bi bi-check"></i>'; // Gray single tick for sent
        }
      }

      let messageHTML = `<strong>${name}:</strong> `;

      if (msg.content && msg.content.startsWith("/uploads/")) {
        const fullImageUrl = `http://localhost:5000${msg.content}`;
        const fileName = msg.content.split("/").pop();

        messageHTML += `
          <div class="image-preview position-relative d-inline-block my-2 border border-1 border-dark rounded overflow-hidden">
            <img src="${fullImageUrl}" alt="Sent Image"
           onclick="openImageModal('${fullImageUrl}', '${fileName}')"
           class="img-fluid rounded" style="max-width: 200px; cursor: pointer;" />
            <!-- Download Button -->
            <button class="btn btn-sm btn-outline-secondary position-absolute bottom-0 end-0 m-1 download-btn"
                    data-filename="${fileName}" title="Download">
              <i class="bi bi-download"></i>
            </button>
          </div>
        `;
      } else {
        messageHTML += msg.content;
      }

      messageHTML += `
  <div class="meta d-flex justify-content-end align-items-center gap-1 mt-1">
    <span class="time text-muted">${ts}</span>
    <span class="tick">${ticks}</span>
  </div>
`;


      div.innerHTML = messageHTML;
      this.elements.messageContainer.appendChild(div);

      if (!isMine) {
        window.ChatGlobals.socket.emit("message-read", msg._id);
        console.log("📨 Emitted message-read:", msg._id);
      }
    },

    async handleImageUpload() {
      const file = this.elements.imageInput.files[0];
      this.elements.imageInput.value = '';
      if (!file || !this.currentChatId || !this.receiverInput.receiverId) return;

      const formData = new FormData();
      formData.append('image', file);
      formData.append('chatId', this.currentChatId);
      formData.append('receiver', this.receiverInput.receiverId);

      try {
        const res = await fetch(`${window.ChatGlobals.API_URL}/messages/upload`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          },
          body: formData
        });

        const message = await res.json();
        if (!res.ok || !message._id) throw new Error(message.message || 'Upload failed');

        this.displayMessage(message);
        window.ChatGlobals.socket.emit('sendMessage', message);
      } catch (err) {
        console.error('❌ Image upload failed:', err);
        alert('Image upload failed.');
      }
    },

    handleTyping() {
      console.log("⌨️ Input event triggered");
      if (!this.elements.msgInput.value.trim()) {
        clearTimeout(this.typingTimeout);
        window.ChatGlobals.socket.emit("stopTyping", { chatId: this.currentChatId });
        return;
      }

      if (!this.isTyping) {
        this.isTyping = true;
        window.ChatGlobals.socket.emit("typing", { chatId: this.currentChatId, name: this.currentUser.name });
        console.log("✏️ Emitting typing", { chatId: this.currentChatId, name: this.currentUser.name });
      }

      clearTimeout(this.typingTimeout);
      this.typingTimeout = setTimeout(() => {
        console.log("⌛ Typing timeout, emitting stopTyping for chat:", this.currentChatId);
        window.ChatGlobals.socket.emit("stopTyping", { chatId: this.currentChatId });
        this.isTyping = false;
      }, 3000);
    },

    handleMessageContainerClick(event) {
      // Download button
      if (event.target.classList.contains('download-btn')) {
        const fileName = event.target.getAttribute('data-filename');
        if (fileName) {
          const downloadLink = document.createElement('a');
          downloadLink.href = `http://localhost:5000/download/${fileName}`;
          downloadLink.setAttribute('download', fileName);
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
        }
      }

      // Close image preview
      if (event.target.classList.contains('close-preview')) {
        const previewBox = event.target.closest('.image-preview');
        if (previewBox) previewBox.remove();
      }
    },

    async sendMessage() {
      const msgText = this.elements.msgInput.value.trim();
      if (!msgText) return;

      if (!this.receiverInput.receiverId) {
        try {
          const res = await fetch(`${window.ChatGlobals.API_URL}/chats/${this.currentChatId}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
          });

          if (res.ok) {
            const chat = await res.json();
            if (chat.users && Array.isArray(chat.users)) {
              const otherUser = chat.users.find(u => u._id !== this.currentUser._id);
              this.receiverInput.receiverId = otherUser?._id;
            }
          }
        } catch (err) {
          console.error("❌ Error getting chat details:", err);
        }
      }

      const payload = {
        chatId: this.currentChatId,
        receiver: this.receiverInput.receiverId,
        content: msgText
      };

      try {
        const res = await fetch(`${window.ChatGlobals.API_URL}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          console.error("❌ Failed to send message");
          return;
        }

        const msg = await res.json();
        this.displayMessage(msg);
        this.scrollToBottom();
        window.ChatGlobals.socket.emit("sendMessage", msg);
        console.log("📤 Emitted sendMessage:", msg);
        this.elements.msgInput.value = "";
        this.isTyping = false;
        window.ChatGlobals.socket.emit("stopTyping", { chatId: this.currentChatId });
      } catch (err) {
        console.error("❌ Error sending message:", err);
      }
    },

    async softDeleteChatsForCurrentUser() {
      if (!this.currentChatId) return;

      try {
        const res = await fetch(`${window.ChatGlobals.API_URL}/messages/soft-delete/${this.currentChatId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });

        if (!res.ok) throw new Error("Failed to delete chats");

        this.elements.messageContainer.innerHTML = "";
        console.log("🗑️ Chat hidden for current user.");
      } catch (err) {
        console.error("❌ Error hiding chat:", err);
        alert("Could not delete chat. Try again.");
      }
    },

    formatTime(timestamp) {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    },

    scrollToBottom() {
      this.elements.messageContainer.scrollTop = this.elements.messageContainer.scrollHeight;
    }
  };

  // ✅ Expose ChatApp to global scope
  window.ChatApp = ChatApp;

  // ✅ Create the initialization function
  window.initChatApp = async function () {
    console.log("🌐 Initializing chat app...");
    if (window.ChatApp) {
      await window.ChatApp.init();
    } else {
      console.error("❌ ChatApp not available");
    }
  };

  // Global functions that might be needed
  window.openImageModal = function (imageUrl, fileName) {
    const modal = document.getElementById('imageModal');
    const previewImage = document.getElementById('previewImage');
    const downloadLink = document.getElementById('downloadImage');

    if (modal && previewImage && downloadLink) {
      previewImage.src = imageUrl;
      downloadLink.href = `http://localhost:5000/download/${fileName}?t=${Date.now()}`;
      downloadLink.setAttribute("download", fileName);
      modal.style.display = 'flex';
    }
  };

  window.closeImageModal = function () {
    const modal = document.getElementById('imageModal');
    if (modal) {
      modal.style.display = 'none';
    }
  };

  console.log("📦 Chat.js loaded successfully");

})();