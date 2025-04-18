const socket = io();

// DOM Elements
const startCallBtn = document.getElementById("startCall");
const joinCallBtn = document.getElementById("joinCall");
const roomIdInput = document.getElementById("roomId");
const roomNumberDisplay = document.getElementById("roomNumber");
const activeRoomDisplay = document.getElementById("activeRoomNumber");
const generatedIdDisplay = document.getElementById("generatedId");
const setupScreen = document.querySelector(".setup-screen");
const callScreen = document.querySelector(".call-screen");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const muteAudioBtn = document.getElementById("muteAudio");
const muteVideoBtn = document.getElementById("muteVideo");
const joinRequestsContainer = document.getElementById("joinRequests");

// Global State
let myPeer;
let myStream;
let roomId;
let myPeerId;
let isRoomHost = false;
let audioEnabled = true;
let videoEnabled = true;
let connectedPeers = {};
let currentRemoteUserId = null;

// Start new meeting
startCallBtn.onclick = async () => {
  roomId = generateRoomId();
  isRoomHost = true;
  startCall(roomId);
};

// Join existing meeting
joinCallBtn.onclick = () => {
  const inputId = roomIdInput.value.trim();
  if (!inputId) return alert("Enter a Room ID");
  roomId = inputId;
  isRoomHost = false;
  startCall(roomId);
};

// Core function to initiate call setup
async function startCall(roomId) {
  try {
    myStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = myStream;
    localVideo.muted = true;
    localVideo.play();
  } catch (err) {
    console.error("Failed to get media stream:", err);
    alert("Could not access camera or microphone. Please check your permissions.");
    return;
  }

  myPeer = new Peer(undefined, {
    host: "0.peerjs.com",
    port: 443,
    secure: true,
    path: "/"
  });

  myPeer.on("open", id => {
    myPeerId = id;
    console.log("My peer ID:", myPeerId);
    
    if (isRoomHost) {
      socket.emit("join-room", roomId, id, "host");
      activeRoomDisplay.textContent = roomId;
      roomNumberDisplay.textContent = roomId;
      setupScreen.classList.add("hidden");
      callScreen.classList.remove("hidden");
      generatedIdDisplay.classList.remove("hidden");
    } else {
      // For joiners, request permission first
      socket.emit("request-join", roomId, id);
      document.querySelector(".setup-screen").innerHTML = "<h2>Waiting for host approval...</h2>";
    }
  });

  // For both host and joiners: Handle incoming calls
  myPeer.on("call", call => {
    console.log("Received call from:", call.peer);
    
    // Always answer incoming calls with our stream
    call.answer(myStream);
    
    // When we receive their stream, display it
    call.on("stream", userVideoStream => {
      console.log("Received remote stream, displaying...");
      remoteVideo.srcObject = userVideoStream;
      remoteVideo.play().catch(e => console.error("Error playing remote video:", e));
      currentRemoteUserId = call.peer;
    });
    
    // Save the connection
    connectedPeers[call.peer] = call;
  });

  // For joiner: Connect when approved
  socket.on("join-approved", hostId => {
    console.log("Join approved by host:", hostId);
    setupScreen.classList.add("hidden");
    callScreen.classList.remove("hidden");
    activeRoomDisplay.textContent = roomId;
    
    // CRITICAL: Immediately call the host after approval
    setTimeout(() => {
      callUser(hostId);
    }, 1000);
  });

  // For host: Connect to new user who joined
  socket.on("user-connected", userId => {
    console.log("User connected:", userId);
    
    // If I'm the host and a new user connected after approval
    if (isRoomHost && userId !== myPeerId) {
      console.log("Host initiating call to new user:", userId);
      
      // Use setTimeout to ensure signaling is complete
      setTimeout(() => {
        callUser(userId);
      }, 1000);
    }
  });

  // For host: Handle join requests
  socket.on("user-request-join", (userId, roomId) => {
    if (isRoomHost) {
      console.log("User requesting to join:", userId);
      createJoinRequest(userId, roomId);
    }
  });

  socket.on("join-rejected", () => {
    alert("Your request to join was declined by the host.");
    window.location.reload();
  });

  socket.on("user-disconnected", userId => {
    console.log("User disconnected:", userId);
    
    if (connectedPeers[userId]) {
      connectedPeers[userId].close();
      delete connectedPeers[userId];
    }
    
    if (currentRemoteUserId === userId && remoteVideo.srcObject) {
      remoteVideo.srcObject.getTracks().forEach(track => track.stop());
      remoteVideo.srcObject = null;
    }
  });
}

// Function to call another user
function callUser(userId) {
  console.log("Calling user:", userId);
  
  if (!myStream) {
    console.error("No local stream to share");
    return;
  }
  
  // Check if we're already connected
  if (connectedPeers[userId]) {
    console.log("Already connected to:", userId);
    return;
  }
  
  // Create a new call
  const call = myPeer.call(userId, myStream);
  
  if (!call) {
    console.error("Failed to create call object");
    return;
  }
  
  call.on("stream", userVideoStream => {
    console.log("Received stream from user:", userId);
    remoteVideo.srcObject = userVideoStream;
    remoteVideo.play().catch(e => console.error("Error playing remote video:", e));
    currentRemoteUserId = userId;
  });
  
  call.on("close", () => {
    console.log("Call closed with:", userId);
    if (currentRemoteUserId === userId) {
      remoteVideo.srcObject = null;
      currentRemoteUserId = null;
    }
  });
  
  call.on("error", err => {
    console.error("Call error:", err);
  });
  
  // Save the call reference
  connectedPeers[userId] = call;
}

// Create UI for join requests
function createJoinRequest(userId, roomId) {
  const requestElement = document.createElement("div");
  requestElement.className = "join-request";
  requestElement.innerHTML = `
    <p>User is requesting to join</p>
    <div class="request-buttons">
      <button class="accept-btn">Accept</button>
      <button class="reject-btn">Decline</button>
    </div>
  `;
  
  joinRequestsContainer.appendChild(requestElement);
  
  // Add event listeners for the buttons
  requestElement.querySelector(".accept-btn").addEventListener("click", () => {
    socket.emit("approve-join", roomId, userId);
    requestElement.remove();
  });
  
  requestElement.querySelector(".reject-btn").addEventListener("click", () => {
    socket.emit("reject-join", roomId, userId);
    requestElement.remove();
  });
}

// Utility to generate random room ID
function generateRoomId() {
  return Math.random().toString(36).substring(2, 12);
}

// Copy room ID function
function copyRoomId() {
  const roomNumberToCopy = isRoomHost ? roomNumberDisplay.textContent : activeRoomDisplay.textContent;
  navigator.clipboard.writeText(roomNumberToCopy)
    .then(() => {
      alert("Room ID copied to clipboard!");
    })
    .catch(err => {
      console.error("Could not copy text: ", err);
    });
}

// Audio Controls
muteAudioBtn.addEventListener('click', () => {
  audioEnabled = !audioEnabled;
  myStream.getAudioTracks().forEach(track => {
    track.enabled = audioEnabled;
  });
  muteAudioBtn.textContent = audioEnabled ? "Mute Audio" : "Unmute Audio";
  muteAudioBtn.classList.toggle("muted", !audioEnabled);
});

// Video Controls
muteVideoBtn.addEventListener('click', () => {
  videoEnabled = !videoEnabled;
  myStream.getVideoTracks().forEach(track => {
    track.enabled = videoEnabled;
  });
  muteVideoBtn.textContent = videoEnabled ? "Mute Video" : "Unmute Video";
  muteVideoBtn.classList.toggle("muted", !videoEnabled);
});

// Make copyRoomId globally available for the onclick handler
window.copyRoomId = copyRoomId;


