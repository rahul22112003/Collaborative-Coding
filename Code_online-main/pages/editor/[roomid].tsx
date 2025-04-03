// pages/editor/[roomid].tsx

import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import React, { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Socket } from "socket.io-client";
import PrimaryButton from "../../components/Button";
import ClientAvatar from "../../components/ClientAvatar";
import ConsoleSection from "../../components/ConsoleSection";
import EditorComponent from "../../components/EditorComponent";
import { useGlobalContext } from "../../contexts/Globalcontext";
import { dummyFilesData } from "../../helpers/data";
import { initSocket } from "../../helpers/socket";
import { ACTIONS } from "../../helpers/SocketActions";
import Peer, { MediaConnection } from "peerjs";

interface EditorProps { }

const EditorContainer: React.FC<EditorProps> = () => {
  // Code editor states
  const [html, setHtml] = useState("<h1>Hello World</h1>");
  const [css, setCss] = useState("");
  const [js, setJs] = useState("console.log('Hello world')");
  const [srcDoc, setSrcDoc] = useState("");

  // Connected clients state
  const [clientList, setClients] = useState<any[]>([]);
  const [peers, setPeers] = useState<Record<string, MediaConnection>>({});
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const router = useRouter();
  const roomId = router.query.roomid;
  const { name } = useGlobalContext();

  // Editor file state
  const fileNameBarClasses =
    "flex items-center cursor-pointer hover:bg-black justify-start w-full p-2 ";
  const [activeFile, setActiveFile] =
    useState<keyof typeof dummyFilesData>("index.html");

  // Create a new PeerJS instance with a public STUN server.
  // (PeerJS will auto-generate an ID)
  const myPeer = new Peer({
    config: {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    },
  });

  // Function to add an audio stream to the DOM so the audio plays
  const addAudioStream = (audioStream: MediaStream) => {
    const audio = document.createElement("audio");
    audio.srcObject = audioStream;
    audio.autoplay = true;
    audio.controls = true; // Show controls for debugging
    document.body.appendChild(audio);
  };

  useEffect(() => {
    // Request microphone access
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((audioStream) => {
        console.log("Audio stream obtained:", audioStream);
        setStream(audioStream);

        // When the PeerJS connection is ready, emit the JOIN event with your peerId
        myPeer.on("open", (id) => {
          console.log("PeerJS open, my peerId:", id);
          socketRef.current?.emit(ACTIONS.JOIN, {
            roomId,
            username: name || "",
            peerId: id,
          });
        });

        // Answer incoming calls by sending your audio stream
        myPeer.on("call", (call) => {
          console.log("Incoming call from peer:", call.peer);
          call.answer(audioStream);
          call.on("stream", (userStream) => {
            console.log("Received remote stream from peer (incoming):", call.peer);
            addAudioStream(userStream);
          });
        });

        // When a new user connects, update the client list, show a toast, and call them
        socketRef.current?.on(
          "user-connected",
          (data: { socketId: string; username: string; peerId: string }) => {
            console.log("User-connected event received:", data);
            // Update the client list if not already present
            setClients((prev) => {
              if (!prev.some((client) => client.socketId === data.socketId)) {
                return [...prev, data];
              }
              return prev;
            });
            // Show a toast notification if a username is provided
            if (data.username) {
              toast.success(`${data.username} joined the room`);
            }
            // Call the new peer with our audio stream
            const call = myPeer.call(data.peerId, audioStream);
            call.on("stream", (userStream) => {
              console.log("Received remote stream after calling peer:", data.peerId);
              addAudioStream(userStream);
            });
            setPeers((prev) => ({ ...prev, [data.peerId]: call }));
          }
        );
      })
      .catch((err) => {
        console.error("Error accessing microphone:", err);
        toast.error("Failed to access microphone");
      });

    // Listen for user disconnection (for voice calls)
    socketRef.current?.on("user-disconnected", (data: { socketId: string }) => {
      console.log("User disconnected event received:", data.socketId);
      setClients((prev) =>
        prev.filter((client) => client.socketId !== data.socketId)
      );
    });

    // Cleanup: stop audio tracks on unmount
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // Toggle microphone mute/unmute
  const toggleMute = () => {
    if (!stream) return;
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length > 0) {
      const newMuteState = !audioTracks[0].enabled;
      audioTracks[0].enabled = newMuteState;
      setIsMuted(!newMuteState);
      console.log("Microphone mute toggled. Now enabled:", audioTracks[0].enabled);
    }
  };

  // Handle JOINED event: update client list and sync code
  // (JOINED event is sent only to the joining client)
  function joinEventhandler({ clients, username, socketId }: any) {
    console.log("JOINED event received:", { clients, username, socketId });
    setClients(clients);
    socketRef.current?.emit(ACTIONS.SYNC_CODE, {
      socketId,
      html,
      css,
      js,
    });
  }

  // Error handling for socket connection
  function handleErrors(e?: Error) {
    console.error("Socket error:", e?.message);
    toast.error("Socket connection failed, try again later");
    setTimeout(() => {
      // router.push("/");
    }, 4000);
  }

  // Copy room ID to clipboard
  async function copyRoomId() {
    try {
      await navigator.clipboard.writeText(roomId as string);
      toast.success("Room ID has been copied to your clipboard");
    } catch (err) {
      toast.error("Could not copy the Room ID");
      console.error(err);
    }
  }

  // Leave the room
  function leaveRoom() {
    // Emit a leave event so the server broadcasts the disconnection immediately
    socketRef.current?.emit(ACTIONS.LEAVE, { roomId, username: name });
    // Stop the audio stream (turn off microphone)
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    // Disconnect the socket connection
    socketRef.current?.disconnect();
    // Destroy the PeerJS instance
    myPeer.destroy();
    // Remove all audio elements from the DOM
    document.querySelectorAll("audio").forEach((audio) => audio.remove());
    router.push("/");
  }

  // Initialize the socket connection and set up event listeners
  useEffect(() => {
    if (!name || name === "") {
      router.push("/");
    }

    const init = async () => {
      socketRef.current = await initSocket();
      socketRef.current.on("connect_error", (err) => handleErrors(err));
      socketRef.current.on("connect_failed", (err) => handleErrors(err));

      // Listen for the JOINED event, which includes the list of connected clients
      socketRef.current.on(ACTIONS.JOINED, joinEventhandler);

      // Listen for code changes
      socketRef.current.on(ACTIONS.CODE_CHANGE, ({ html, css, js }) => {
        console.log("CODE_CHANGE event received");
        setHtml(html);
        setCss(css);
        setJs(js);
      });

      // Listen for disconnection notifications (if a user leaves via disconnect)
      socketRef.current.on("user-disconnected", (data: { socketId: string; username: string }) => {
        toast.success(`${data.username} has left the room`);
        setClients((prev) =>
          prev.filter((client: any) => client.socketId !== data.socketId)
        );
      });
    };

    init();

    return () => {
      socketRef.current?.disconnect();
      socketRef.current?.off(ACTIONS.JOINED);
      socketRef.current?.off("user-disconnected");
    };
  }, []);

  // Update the preview iframe with current code
  const changeCode = () => {
    setSrcDoc(`
      <html>
        <style>${css}</style>
        <body>${html}</body>
        <script>
          const originalLog = console.log;
          console.log = (...args) => {
            parent.window.postMessage({ type: 'log', args: args }, '*');
            originalLog(...args);
          };
          const originalWarn = console.warn;
          console.warn = (...args) => {
            parent.window.postMessage({ type: 'warn', args: args }, '*');
            originalWarn(...args);
          };
          const originalError = console.error;
          console.error = (...args) => {
            parent.window.postMessage({ type: 'error', args: args }, '*');
            originalError(...args);
          };
          window.onerror = function(msg, url, line){
            parent.window.postMessage({ type: 'error', args: msg, line: line }, '*');
          };
          ${js}
        </script>
      </html>
    `);
  };

  // Update preview after a delay
  useEffect(() => {
    const timeout = setTimeout(() => {
      changeCode();
    }, 1000);
    return () => clearTimeout(timeout);
  }, [html, css, js]);

  // Get code for the active file
  const getCodeByFileName = (fileName: keyof typeof dummyFilesData): string => {
    switch (fileName) {
      case "index.html":
        return html;
      case "style.css":
        return css;
      case "script.js":
        return js;
      default:
        return "";
    }
  };

  // Update code and emit changes via socket
  const ChangeCodeByFileName = (
    fileName: keyof typeof dummyFilesData,
    value: string
  ) => {
    switch (fileName) {
      case "index.html":
        setHtml(value);
        break;
      case "style.css":
        setCss(value);
        break;
      case "script.js":
        setJs(value);
        break;
      default:
        break;
    }
    socketRef.current?.emit(ACTIONS.CODE_CHANGE, {
      roomId,
      js: fileName === "script.js" ? value : js,
      css: fileName === "style.css" ? value : css,
      html: fileName === "index.html" ? value : html,
    });
  };

  return (
    <div className="flex flex-col bg-gradient-to-b from-cyan-400 via-blue-400 to-indigo-800 min-h-screen text-white">
      <Head>
        <title>Editor | Code Here</title>
      </Head>

      {/* Top Section: Logo and Title */}
      <div className="flex flex-col items-center w-full py-4">
        <div className="flex items-center space-x-2">
          <Image width={50} height={50} src="/logo-white.png" alt="Logo" />
          <h1 className="font-extrabold text-3xl">Code Here</h1>
        </div>
        <hr className="w-full border-white mt-2" />
      </div>

      {/* Programming Languages Section */}
      <div className="flex gap-4 justify-center py-4 w-full px-8">
        {Object.keys(dummyFilesData).map((keyName) => {
          const fileData = dummyFilesData[keyName as keyof typeof dummyFilesData];
          return (
            <div
              key={fileData.name}
              onClick={() => setActiveFile(fileData.name as keyof typeof dummyFilesData)}
              className={`cursor-pointer flex flex-col justify-center items-center w-32 h-20 rounded-md ${fileData.name === activeFile ? "bg-purple-600" : "bg-gray-800"
                }`}
            >
              <Image width="30" height="20px" src={fileData.iconName} alt={fileData.name} />
              <p className="text-center">{fileData.name}</p>
            </div>
          );
        })}
      </div>

      {/* Main Section: Editor & Console (Fixed Height) */}
      <div className="grid grid-cols-2 gap-2 w-full px-4 relative" style={{ height: "50vh" }}>
        {/* Editor Component */}
        <div className="w-full h-full overflow-hidden">
          <EditorComponent
            onClickFunc={changeCode}
            onChange={(value) => ChangeCodeByFileName(activeFile, value as string)}
            code={getCodeByFileName(activeFile)}
            language={dummyFilesData[activeFile]?.language}
          />
        </div>

        {/* Console Section */}
        <div className="flex flex-col w-full h-full overflow-hidden">
          <iframe srcDoc={srcDoc} className="w-full h-3/4 bg-white" />
          <div className="h-1/4 bg-bgdark">
            <ConsoleSection />
          </div>
        </div>
      </div>

      {/* Footer Section (Always Below) */}
      <div className="flex flex-col justify-center items-center space-x-4 py-6 relative">
        {/* Connected People */}
        <div className="flex flex-col items-center">
          <h3 className="mx-3 text-lg font-semibold">Connected</h3>
          <div className="flex flex-wrap">
            {clientList.map((client: any) => (
              <ClientAvatar key={client.socketId} username={client.username} />
            ))}
          </div>
        </div>

        <div className="flex space-x-5">
          {/* Mute/Unmute*/}
          <button onClick={toggleMute} className="w-32 p-3 bg-blue-500 text-white rounded">
            {isMuted ? "Unmute" : "Mute"}
          </button>
          {/* Copy room id */}
          <button onClick={copyRoomId} className="w-34 p-3 bg-white text-black rounded">
            Copy ROOM ID
          </button>
          {/* Leave button */}
          <button onClick={leaveRoom} className="w-32 p-3 bg-red-500 text-white rounded">
            Leave
          </button>
        </div>
      </div>
    </div>

  );
};

export default EditorContainer;