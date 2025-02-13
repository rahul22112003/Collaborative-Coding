import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import Peer, { MediaConnection } from "peerjs";
import { useRouter } from "next/router";
import toast from "react-hot-toast";
import { useGlobalContext } from "../../contexts/Globalcontext";
import { ACTIONS } from "../../helpers/SocketActions";
import { initSocket } from "../../helpers/socket";

const EditorContainer: React.FC = () => {
  const router = useRouter();
  const roomId = router.query.roomid;
  const { name } = useGlobalContext();
  const [clientList, setClients] = useState([]);
  const [peers, setPeers] = useState<Record<string, MediaConnection>>({});
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  
  const socketRef = useRef<Socket | null>(null);
  const myPeerRef = useRef<Peer | null>(null);

  useEffect(() => {
    const startVoiceChat = async () => {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setStream(audioStream);

        myPeerRef.current = new Peer("", {
          debug: 2, // ✅ Add debug mode for troubleshooting
        });

        myPeerRef.current.on("open", (id) => {
          console.log("My peer ID:", id);
          socketRef.current?.emit("join-room", roomId, id);
        });

        myPeerRef.current.on("call", (call) => {
          call.answer(audioStream);
          call.on("stream", (userStream) => {
            console.log("Received stream from peer:", userStream);
            addAudioStream(userStream);
          });
        });

        socketRef.current?.on("user-connected", (userId) => {
          console.log("User connected:", userId);
          const call = myPeerRef.current?.call(userId, audioStream);
          call?.on("stream", (userStream) => {
            addAudioStream(userStream);
          });

          setPeers((prev) => ({
            ...prev,
            [userId]: call!,
          }));
        });

        socketRef.current?.on("user-disconnected", (userId) => {
          console.log("User disconnected:", userId);
          if (peers[userId]) {
            peers[userId].close();
            setPeers((prev) => {
              const updatedPeers = { ...prev };
              delete updatedPeers[userId];
              return updatedPeers;
            });
          }
        });

      } catch (error) {
        console.error("Error accessing microphone:", error);
        toast.error("Microphone access failed");
      }
    };

    startVoiceChat();

    return () => {
      stream?.getTracks().forEach((track) => track.stop());
      myPeerRef.current?.disconnect();
    };
  }, []);

  const addAudioStream = (stream: MediaStream) => {
    const audio = document.createElement("audio");
    audio.srcObject = stream;
    audio.autoplay = true;
    document.body.appendChild(audio);
  };

  const toggleMute = () => {
    if (!stream) return;
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length > 0) {
      const newMuteState = !audioTracks[0].enabled;
      audioTracks[0].enabled = newMuteState;
      setIsMuted(!newMuteState);
    }
  };

  return (
    <div>
      <button onClick={toggleMute} className="p-2 bg-blue-500 text-white rounded">
        {isMuted ? "Unmute" : "Mute"}
      </button>
    </div>
  );
};

export default EditorContainer;
