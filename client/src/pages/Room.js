import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Peer from "simple-peer";
import io from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { useAudioLevel } from "../hooks/useAudioLevel";
import axios from "axios";

// WebRTC Configuration
const peerConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ]
};

function Room() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Media streams
  const [myStream, setMyStream] = useState(null);
  const [peers, setPeers] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [screenStream, setScreenStream] = useState(null);

  // UI state
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const [showPdf, setShowPdf] = useState(false);

  // Chat
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");

  // PDF
  const [pdfState, setPdfState] = useState(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  // Active speakers
  const [activeSpeakers, setActiveSpeakers] = useState(new Set());

  // Refs
  const myVideo = useRef();
  const socketRef = useRef();
  const streamRef = useRef();
  const peersRef = useRef([]);
  const chatEndRef = useRef();
  const fileInputRef = useRef();
  const iceCandidatesQueue = useRef({}); // Buffer for out-of-order candidates

  const host = window.location.hostname;
  const API_URL = '/api';

  // Detect if I'm speaking
  const isSpeaking = useAudioLevel(myStream);

  useEffect(() => {
    if (isSpeaking) {
      socketRef.current?.emit("user-speaking", {
        roomId,
        userId: user.id,
        userName: user.nombre
      });
    } else {
      socketRef.current?.emit("user-stopped-speaking", {
        roomId,
        userId: user.id
      });
    }
  }, [isSpeaking]);

  useEffect(() => {
    // Check if mediaDevices is available (requires HTTPS or localhost)
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert(
        "⚠️ WebRTC no está disponible.\n\n" +
        "Para usar video/audio, debes acceder desde:\n" +
        "• http://localhost:3000 (en este equipo)\n" +
        "• https://... (conexión segura)\n\n" +
        "Actualmente estás en: " + window.location.href + "\n\n" +
        "El chat y PDF funcionarán, pero no el video."
      );
      // Continue without video/audio
      socketRef.current = io.connect(window.location.origin);
      const socket = socketRef.current;

      socket.emit("join-room", {
        roomId,
        userId: user.id,
        userName: user.nombre
      });

      loadChatHistory();
      return;
    }

    // Initialize socket
    socketRef.current = io.connect(window.location.origin);
    const socket = socketRef.current;

    // Get user media
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((currentStream) => {
        setMyStream(currentStream);
        // Save stream to ref for access in event listeners
        streamRef.current = currentStream;

        if (myVideo.current) {
          myVideo.current.srcObject = currentStream;
        }

        // Join room
        socket.emit("join-room", {
          roomId,
          userId: user.id,
          userName: user.nombre
        });

        // Load chat history
        loadChatHistory();
      })
      .catch((err) => {
        console.error("Error accessing media devices:", err);
        alert(
          "No se pudo acceder a la cámara o micrófono.\n\n" +
          "Posibles causas:\n" +
          "• Permisos denegados\n" +
          "• Cámara/micrófono en uso por otra app\n" +
          "• Dispositivos no disponibles\n\n" +
          "El chat y PDF funcionarán normalmente."
        );

        // Continue without video/audio
        socket.emit("join-room", {
          roomId,
          userId: user.id,
          userName: user.nombre
        });

        loadChatHistory();
      });



    // Socket event listeners
    socket.on("room-participants", (users) => {
      console.log("Current participants:", users);
      setParticipants(users);

      // Create peers for existing participants
      users.forEach((participant) => {
        if (participant.socketId !== socket.id && participant.socketId) {
          // Use stream from ref to ensure we have latest stream
          createPeer(participant.socketId, socket.id, streamRef.current);
        }
      });
    });

    socket.on("user-joined", ({ userId: newUserId, userName, participants: newParticipants }) => {
      console.log(`${userName} joined`);
      setParticipants(newParticipants);
      // The new user will initiate the connection
    });

    socket.on("offer", ({ offer, from }) => {
      console.log("Received signal (offer/candidate) from:", from);

      const existingPeer = peersRef.current.find((p) => p.peerID === from);
      if (existingPeer) {
        // If peer exists, just signal it (for trickle ICE candidates)
        existingPeer.peer.signal(offer);
        return;
      }

      // Use stream from ref
      if (streamRef.current) {
        const peer = addPeer(offer, from, streamRef.current);
        peersRef.current.push({
          peerID: from,
          peer
        });
        setPeers([...peersRef.current]);

        // Process any queued candidates for this peer
        if (iceCandidatesQueue.current[from]) {
          console.log(`Processing ${iceCandidatesQueue.current[from].length} queued candidates for ${from}`);
          iceCandidatesQueue.current[from].forEach(candidate => {
            peer.signal(candidate);
          });
          delete iceCandidatesQueue.current[from];
        }

      } else {
        console.warn("Cannot accept offer, no stream available");
      }
    });

    socket.on("answer", ({ answer, from }) => {
      const item = peersRef.current.find((p) => p.peerID === from);
      if (item) {
        item.peer.signal(answer);
      }
    });

    socket.on("ice-candidate", ({ candidate, from }) => {
      const item = peersRef.current.find((p) => p.peerID === from);
      if (item) {
        item.peer.signal(candidate);
      } else {
        // Queue the candidate if peer not ready yet
        console.log(`Queueing candidate for unknown peer ${from}`);
        if (!iceCandidatesQueue.current[from]) {
          iceCandidatesQueue.current[from] = [];
        }
        iceCandidatesQueue.current[from].push(candidate);
      }
    });

    socket.on("user-left", ({ socketId, participants: newParticipants }) => {
      const peerObj = peersRef.current.find((p) => p.peerID === socketId);
      if (peerObj) {
        peerObj.peer.destroy();
      }
      peersRef.current = peersRef.current.filter((p) => p.peerID !== socketId);
      setPeers([...peersRef.current]);
      setParticipants(newParticipants);

      setActiveSpeakers(prev => {
        const newSet = new Set(prev);
        newSet.delete(socketId);
        return newSet;
      });
    });

    // Chat events
    socket.on("receive-message", (message) => {
      setMessages((prev) => [...prev, message]);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });

    // PDF events
    socket.on("pdf-state", (pdfData) => {
      setPdfState(pdfData);
      setShowPdf(true);
    });

    socket.on("pdf-page-update", ({ currentPage }) => {
      setPdfState((prev) => prev ? { ...prev, currentPage } : null);
    });

    socket.on("pdf-removed", () => {
      setPdfState(null);
      setShowPdf(false);
    });

    // Active speaker events
    socket.on("user-speaking", ({ socketId }) => {
      setActiveSpeakers(prev => new Set(prev).add(socketId));
    });

    socket.on("user-stopped-speaking", ({ socketId }) => {
      setActiveSpeakers(prev => {
        const newSet = new Set(prev);
        newSet.delete(socketId);
        return newSet;
      });
    });

    // Screen sharing events
    socket.on("screen-share-active", ({ socketId }) => {
      console.log("Screen share started by:", socketId);
    });

    socket.on("screen-share-ended", () => {
      console.log("Screen share ended");
    });

    // Cleanup
    return () => {
      if (myStream) {
        myStream.getTracks().forEach((track) => track.stop());
      }
      if (screenStream) {
        screenStream.getTracks().forEach((track) => track.stop());
      }
      peersRef.current.forEach(({ peer }) => peer.destroy());
      socket.disconnect();
    };
  }, [roomId]);

  function createPeer(userToSignal, callerID, stream) {
    const peer = new Peer({
      initiator: true,
      stream,
      config: peerConfig
    });

    peer.on("signal", (signal) => {
      console.log("Generating signal (initiator):", signal.type, "for", userToSignal);

      if (signal.type === 'offer') {
        socketRef.current.emit("offer", {
          roomId,
          offer: signal,
          to: userToSignal
        });
      } else if (signal.candidate || signal.type === 'candidate') {
        socketRef.current.emit("ice-candidate", {
          roomId,
          candidate: signal,
          to: userToSignal
        });
      }
    });

    peer.on("connect", () => {
      console.log("Peer Connection Established with:", userToSignal);
    });

    // Add to peers ref immediately
    peersRef.current.push({
      peerID: userToSignal,
      peer
    });
    setPeers([...peersRef.current]);

    return peer;
  }

  function addPeer(incomingSignal, callerID, stream) {
    const peer = new Peer({
      initiator: false,
      stream,
      config: peerConfig
    });

    peer.on("signal", (signal) => {
      console.log("Generating signal (receiver):", signal.type, "for", callerID);

      if (signal.type === 'answer') {
        socketRef.current.emit("answer", {
          roomId,
          answer: signal,
          to: callerID
        });
      } else if (signal.candidate || signal.type === 'candidate') {
        socketRef.current.emit("ice-candidate", {
          roomId,
          candidate: signal,
          to: callerID
        });
      }
    });

    peer.on("connect", () => {
      console.log("Peer Connection Established with:", callerID);
    });

    peer.signal(incomingSignal);

    return peer;
  }

  const loadChatHistory = async () => {
    try {
      const response = await axios.get(`${API_URL}/chat/${roomId}`);
      setMessages(response.data.messages);
      setTimeout(() => chatEndRef.current?.scrollIntoView(), 100);
    } catch (error) {
      console.error("Error loading chat:", error);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim()) {
      const messageData = {
        roomId,
        userId: user.id,
        userName: user.nombre,
        texto: newMessage,
        timestamp: new Date()
      };
      socketRef.current.emit("send-message", messageData);
      setNewMessage("");
    }
  };

  const toggleAudio = () => {
    if (myStream) {
      const audioTrack = myStream.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      setAudioEnabled(audioTrack.enabled);

      socketRef.current.emit("toggle-audio", {
        roomId,
        userId: user.id,
        audioEnabled: audioTrack.enabled
      });
    }
  };

  const toggleVideo = () => {
    if (myStream) {
      const videoTrack = myStream.getVideoTracks()[0];
      videoTrack.enabled = !videoTrack.enabled;
      setVideoEnabled(videoTrack.enabled);

      socketRef.current.emit("toggle-video", {
        roomId,
        userId: user.id,
        videoEnabled: videoTrack.enabled
      });
    }
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== "application/pdf") {
      alert("Por favor selecciona un archivo PDF");
      return;
    }

    setUploadingPdf(true);
    const formData = new FormData();
    formData.append("pdf", file);
    formData.append("totalPages", "1");

    try {
      const response = await axios.post(
        `${API_URL}/pdf/upload/${roomId}`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" }
        }
      );

      const pdfData = response.data.pdf;
      socketRef.current.emit("pdf-uploaded", { roomId, pdfData });
      setPdfState(pdfData);
      setShowPdf(true);
    } catch (error) {
      console.error("Error uploading PDF:", error);
      alert("Error al subir PDF");
    } finally {
      setUploadingPdf(false);
    }
  };

  const changePdfPage = (direction) => {
    if (!pdfState) return;
    let newPage = pdfState.currentPage + direction;
    if (newPage < 1) newPage = 1;
    if (newPage > pdfState.totalPages) newPage = pdfState.totalPages;

    socketRef.current.emit("pdf-page-changed", { roomId, currentPage: newPage });
    setPdfState({ ...pdfState, currentPage: newPage });
  };

  const shareScreen = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      alert("Compartir pantalla requiere HTTPS o localhost");
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });

      setScreenStream(screenStream);

      const screenTrack = screenStream.getVideoTracks()[0];

      // Replace video track for all peers
      peersRef.current.forEach(({ peer }) => {
        // Find the video track in the current sender
        const sender = peer._pc.getSenders().find(s => s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(screenTrack);
        }
      });

      // Notify server
      socketRef.current.emit("screen-share-started", {
        roomId,
        userId: user.id
      });

      // Update local video to show screen share verify it works
      if (myVideo.current) {
        myVideo.current.srcObject = screenStream;
      }

      screenTrack.onended = () => {
        stopScreenShare();
      };
    } catch (error) {
      console.error("Error sharing screen:", error);
      if (error.name === 'NotAllowedError') {
        // User cancelled
      } else {
        alert("Error al compartir pantalla: " + error.message);
      }
    }
  };

  const stopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
      setScreenStream(null);

      // Revert to camera track
      if (streamRef.current) {
        const videoTrack = streamRef.current.getVideoTracks()[0];

        peersRef.current.forEach(({ peer }) => {
          const sender = peer._pc.getSenders().find(s => s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        });

        // Restore local video
        if (myVideo.current) {
          myVideo.current.srcObject = streamRef.current;
        }
      }

      socketRef.current.emit("screen-share-stopped", { roomId });
    }
  };

  const leaveRoom = () => {
    if (myStream) {
      myStream.getTracks().forEach((track) => track.stop());
    }
    navigate("/");
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg-primary)" }}>
      {/* Main video area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "20px" }}>
        {/* Header */}
        <div style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ color: "var(--text-secondary)", margin: 0 }}>
            Sala: <span style={{ color: "var(--accent-primary)" }}>{roomId}</span>
          </h2>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => setShowChat(!showChat)}
              className="btn"
              style={{ padding: "8px 16px", fontSize: "0.9rem" }}
            >
              {showChat ? "Ocultar" : "Mostrar"} Chat
            </button>
            <button
              onClick={() => setShowPdf(!showPdf)}
              className="btn"
              style={{ padding: "8px 16px", fontSize: "0.9rem" }}
            >
              {showPdf ? "Ocultar" : "Mostrar"} PDF
            </button>
          </div>
        </div>

        {/* Video grid */}
        <div className="video-grid-container" style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: `repeat(auto-fit, minmax(300px, 1fr))`,
          gridAutoRows: "minmax(200px, 1fr)",
          gap: "15px",
          padding: "20px",
          width: "100%",
          maxHeight: "calc(100vh - 150px)",
          overflowY: "auto",
          alignContent: "center"
        }}>
          {/* My video */}
          <div style={{
            position: "relative",
            background: "#1a1a1a",
            borderRadius: "12px",
            overflow: "hidden",
            border: isSpeaking ? "3px solid #10b981" : "3px solid transparent",
            transition: "all 0.3s ease",
            boxShadow: isSpeaking ? "0 0 20px rgba(16, 185, 129, 0.5)" : "0 4px 6px rgba(0,0,0,0.3)",
            aspectRatio: "16/9",
            minHeight: "200px"
          }}>
            <video
              playsInline
              muted
              ref={myVideo}
              autoPlay
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: !screenStream ? "scaleX(-1)" : "none",
                display: videoEnabled || screenStream ? "block" : "none"
              }}
            />
            {!videoEnabled && (
              <div style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
              }}>
                <div style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "2rem",
                  color: "white",
                  fontWeight: "bold"
                }}>
                  {user?.nombre?.charAt(0).toUpperCase()}
                </div>
              </div>
            )}
            <div style={{
              position: "absolute",
              bottom: "10px",
              left: "10px",
              background: "rgba(0,0,0,0.8)",
              padding: "6px 12px",
              borderRadius: "6px",
              color: "white",
              fontSize: "0.9rem",
              fontWeight: "500",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}>
              {!audioEnabled && <span style={{ color: "#ef4444" }}>🔇</span>}
              {user?.nombre} (Tú)
            </div>
            {isSpeaking && (
              <div style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                background: "rgba(16, 185, 129, 0.9)",
                padding: "4px 8px",
                borderRadius: "4px",
                color: "white",
                fontSize: "0.75rem",
                fontWeight: "600"
              }}>
                🎤 Hablando
              </div>
            )}
          </div>

          {/* Peer videos */}
          {peers.map(({ peerID, peer }) => (
            <VideoCard
              key={peerID}
              peer={peer}
              peerID={peerID}
              isActive={activeSpeakers.has(peerID)}
            />
          ))}
        </div>

        {/* Control bar */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          gap: "15px",
          padding: "15px",
          background: "rgba(255,255,255,0.05)",
          borderRadius: "12px"
        }}>
          <button
            onClick={toggleAudio}
            style={{
              padding: "12px 20px",
              borderRadius: "8px",
              border: "none",
              background: audioEnabled ? "var(--accent-primary)" : "#ef4444",
              color: "white",
              cursor: "pointer",
              fontSize: "1rem",
              fontWeight: "500"
            }}
          >
            {audioEnabled ? "🎤 Micrófono" : "🔇 Mutear"}
          </button>
          <button
            onClick={toggleVideo}
            style={{
              padding: "12px 20px",
              borderRadius: "8px",
              border: "none",
              background: videoEnabled ? "var(--accent-primary)" : "#ef4444",
              color: "white",
              cursor: "pointer",
              fontSize: "1rem",
              fontWeight: "500"
            }}
          >
            {videoEnabled ? "📹 Cámara" : "📷 Sin Video"}
          </button>
          <button
            onClick={screenStream ? stopScreenShare : shareScreen}
            style={{
              padding: "12px 20px",
              borderRadius: "8px",
              border: "none",
              background: screenStream ? "#ef4444" : "var(--accent-secondary)",
              color: "white",
              cursor: "pointer",
              fontSize: "1rem",
              fontWeight: "500"
            }}
          >
            {screenStream ? "⏹️ Detener" : "🖥️ Compartir Pantalla"}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingPdf}
            style={{
              padding: "12px 20px",
              borderRadius: "8px",
              border: "none",
              background: "#8b5cf6",
              color: "white",
              cursor: uploadingPdf ? "not-allowed" : "pointer",
              fontSize: "1rem",
              fontWeight: "500"
            }}
          >
            {uploadingPdf ? "Subiendo..." : "📄 Subir PDF"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handlePdfUpload}
            style={{ display: "none" }}
          />
          <button
            onClick={leaveRoom}
            style={{
              padding: "12px 20px",
              borderRadius: "8px",
              border: "none",
              background: "#dc2626",
              color: "white",
              cursor: "pointer",
              fontSize: "1rem",
              fontWeight: "500"
            }}
          >
            🚪 Salir
          </button>
        </div>
      </div>

      {/* Chat panel */}
      {showChat && (
        <div style={{
          width: "350px",
          background: "rgba(30, 30, 40, 0.95)",
          borderLeft: "1px solid rgba(255,255,255,0.1)",
          display: "flex",
          flexDirection: "column",
          boxShadow: "-4px 0 10px rgba(0,0,0,0.3)"
        }}>
          {/* Participants List - NEW FEATURE */}
          <div style={{
            padding: "15px",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(0,0,0,0.2)"
          }}>
            <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--accent-secondary)" }}>
              👥 Participantes ({participants.length})
            </h3>
            <div style={{ maxHeight: "100px", overflowY: "auto", marginTop: "10px" }}>
              {participants.map(p => (
                <div key={p.socketId || p.userId} style={{ fontSize: "0.85rem", color: "#ccc", padding: "2px 0" }}>
                  • {p.nombre} {p.socketId === socketRef.current?.id ? "(Tú)" : ""}
                </div>
              ))}
            </div>
          </div>

          <div style={{
            padding: "20px",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(0,0,0,0.2)"
          }}>
            <h3 style={{
              margin: 0,
              color: "var(--text-primary)",
              fontSize: "1.1rem",
              fontWeight: "600"
            }}>
              💬 Chat
            </h3>
            <p style={{
              margin: "5px 0 0 0",
              fontSize: "0.75rem",
              color: "var(--text-secondary)"
            }}>
              {messages.length} mensaje{messages.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: "15px",
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }}>
            {messages.length === 0 ? (
              <div style={{
                textAlign: "center",
                color: "var(--text-secondary)",
                padding: "40px 20px",
                fontSize: "0.9rem"
              }}>
                <div style={{ fontSize: "2rem", marginBottom: "10px" }}>💬</div>
                No hay mensajes aún.<br />
                ¡Sé el primero en escribir!
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isMe = msg.userId === user.id;
                const time = new Date(msg.timestamp).toLocaleTimeString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <div key={idx} style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: isMe ? "flex-end" : "flex-start",
                    animation: "fadeIn 0.3s ease"
                  }}>
                    {!isMe && (
                      <div style={{
                        fontSize: "0.75rem",
                        color: "var(--accent-primary)",
                        marginBottom: "3px",
                        fontWeight: "600"
                      }}>
                        {msg.userName}
                      </div>
                    )}
                    <div style={{
                      background: isMe
                        ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                        : "rgba(255,255,255,0.08)",
                      padding: "10px 14px",
                      borderRadius: isMe ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                      maxWidth: "80%",
                      wordWrap: "break-word",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                    }}>
                      <div style={{
                        color: "var(--text-primary)",
                        fontSize: "0.95rem",
                        lineHeight: "1.4"
                      }}>
                        {msg.texto}
                      </div>
                      <div style={{
                        fontSize: "0.7rem",
                        color: isMe ? "rgba(255,255,255,0.7)" : "var(--text-secondary)",
                        marginTop: "4px",
                        textAlign: "right"
                      }}>
                        {time}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={sendMessage} style={{
            padding: "15px",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
            gap: "10px",
            background: "rgba(0,0,0,0.2)"
          }}>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Escribe un mensaje..."
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.05)",
                color: "var(--text-primary)",
                fontSize: "0.95rem",
                outline: "none",
                transition: "all 0.2s"
              }}
              onFocus={(e) => e.target.style.borderColor = "var(--accent-primary)"}
              onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
            />
            <button
              type="submit"
              className="btn"
              style={{
                padding: "12px 20px",
                minWidth: "70px",
                fontSize: "0.9rem"
              }}
              disabled={!newMessage.trim()}
            >
              Enviar
            </button>
          </form>
        </div>
      )}

      {/* PDF panel */}
      {showPdf && pdfState && (
        <div style={{
          width: "400px",
          background: "rgba(255,255,255,0.03)",
          borderLeft: "1px solid rgba(255,255,255,0.1)",
          display: "flex",
          flexDirection: "column"
        }}>
          <div style={{
            padding: "20px",
            borderBottom: "1px solid rgba(255,255,255,0.1)"
          }}>
            <h3 style={{ margin: 0, color: "var(--text-primary)" }}>PDF Compartido</h3>
          </div>
          <div style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            background: "#2a2a2a"
          }}>
            <iframe
              src={`${API_URL}/pdf/file/${pdfState.filename}#page=${pdfState.currentPage}`}
              style={{ width: "100%", height: "100%", border: "none" }}
              title="PDF Viewer"
            />
          </div>
          <div style={{
            padding: "15px",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <button
              onClick={() => changePdfPage(-1)}
              disabled={pdfState.currentPage === 1}
              className="btn"
              style={{ padding: "8px 16px" }}
            >
              ← Anterior
            </button>
            <span style={{ color: "var(--text-primary)" }}>
              {pdfState.currentPage} / {pdfState.totalPages}
            </span>
            <button
              onClick={() => changePdfPage(1)}
              disabled={pdfState.currentPage === pdfState.totalPages}
              className="btn"
              style={{ padding: "8px 16px" }}
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function VideoCard({ peer, peerID, isActive }) {
  const ref = useRef();
  const [hasVideo, setHasVideo] = useState(true);
  const [status, setStatus] = useState("Conectando...");
  const [debugInfo, setDebugInfo] = useState("");

  useEffect(() => {
    // 1. Define event handler
    const handleStream = (stream) => {
      console.log(`VideoCard: Stream received for ${peerID}`, stream.getTracks());
      if (ref.current) {
        ref.current.srcObject = stream;
        const videoTracks = stream.getVideoTracks();
        setHasVideo(videoTracks.length > 0 && videoTracks[0].enabled);
        setStatus("Conectado 🟢");
      }
    };

    // 2. Listen for event
    peer.on("stream", handleStream);

    // 3. CRITICAL: Check if stream already exists (missed event)
    if (peer._remoteStreams && peer._remoteStreams.length > 0) {
      console.log(`VideoCard: Found existing stream for ${peerID}`);
      handleStream(peer._remoteStreams[0]);
    }

    peer.on("connect", () => {
      console.log(`VideoCard: Peer ${peerID} connected`);
      setStatus("Negociando medios... 🟡");
    });

    peer.on("error", (err) => {
      console.error(`VideoCard: Peer error for ${peerID}:`, err);
      setStatus(`Error: ${err.code || err.message} 🔴`);
      setDebugInfo(err.toString());
    });

    peer.on("close", () => {
      setStatus("Desconectado ⚫");
    });

    // Handle track mute/unmute events
    peer.on("track", (track, stream) => {
      track.onmute = () => {
        if (track.kind === 'video') setHasVideo(false);
      };
      track.onunmute = () => {
        if (track.kind === 'video') setHasVideo(true);
      };
    });

  }, [peer, peerID]);

  return (
    <div style={{
      position: "relative",
      background: "#1a1a1a",
      borderRadius: "12px",
      overflow: "hidden",
      border: isActive ? "3px solid #10b981" : "3px solid transparent",
      transition: "all 0.3s ease",
      boxShadow: isActive ? "0 0 20px rgba(16, 185, 129, 0.5)" : "0 4px 6px rgba(0,0,0,0.3)",
      aspectRatio: "16/9",
      minHeight: "200px"
    }}>
      <video
        playsInline
        autoPlay
        ref={ref}
        id={`video-${peerID}`}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: hasVideo ? "block" : "none",
          backgroundColor: "#000" // Ensure black background if loading
        }}
      />

      {/* Overlay for status when video is active but maybe black */}
      <div style={{
        position: "absolute",
        top: "5px",
        left: "5px",
        zIndex: 10,
        background: "rgba(0,0,0,0.6)",
        padding: "2px 6px",
        borderRadius: "4px",
        fontSize: "0.7rem",
        color: status.includes("Error") ? "#ff4444" : "#ffffff",
        pointerEvents: "none"
      }}>
        {status}
      </div>

      {!hasVideo && (
        <div style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
          position: "absolute",
          top: 0,
          left: 0
        }}>
          <div style={{
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "2rem",
            color: "white",
            fontWeight: "bold",
            marginBottom: "10px"
          }}>
            👤
          </div>
          <div style={{ color: "white", fontSize: "0.8rem" }}>Cámara apagada</div>
        </div>
      )}

      {/* Debug Info Overlay (if error) */}
      {debugInfo && (
        <div style={{
          position: "absolute",
          bottom: "40px",
          left: "0",
          right: "0",
          background: "rgba(255,0,0,0.8)",
          color: "white",
          fontSize: "0.7rem",
          padding: "5px",
          wordBreak: "break-all"
        }}>
          {debugInfo}
        </div>
      )}

      <div style={{
        position: "absolute",
        bottom: "10px",
        left: "10px",
        background: "rgba(0,0,0,0.8)",
        padding: "6px 12px",
        borderRadius: "6px",
        color: "white",
        fontSize: "0.9rem",
        fontWeight: "500"
      }}>
        Participante
      </div>
      {isActive && (
        <div style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          background: "rgba(16, 185, 129, 0.9)",
          padding: "4px 8px",
          borderRadius: "4px",
          color: "white",
          fontSize: "0.75rem",
          fontWeight: "600"
        }}>
          🎤 Hablando
        </div>
      )}
    </div>
  );
}

export default Room;
