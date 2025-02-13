import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import React, { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { io, Socket } from "socket.io-client";
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

const EditorContainer: React.FC<EditorProps> = ({ }) => {
  const [html, setHtml] = useState("<h1>Hello World</h1>");
  const [css, setCss] = useState("");
  const [js, setJs] = useState("console.log('Hello world')");

  const fileNameBarClasses =
    "flex items-center cursor-pointer hover:bg-black justify-start w-full p-2 ";
  const [activeFile, setActiveFile] = useState("index.html");
  const [srcDoc, setSrcDoc] = useState("");
  const socketRef = useRef<Socket | null>(null);
  const router = useRouter();
  const roomId = router.query.roomid;
  const { name } = useGlobalContext();
  const [clientList, setClients] = useState([]);
  const [peers, setPeers] = useState<Record<string, MediaConnection>>({});
  const [stream, setStream] = useState<MediaStream | null>(null);
  const myPeer = new Peer();

  const addAudioStream = (stream: MediaStream) => {
    const audio = document.createElement("audio");
    audio.srcObject = stream;
    audio.autoplay = true;
    document.body.appendChild(audio);
  };

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true }).then((audioStream) => {
      setStream(audioStream);
      myPeer.on("call", (call) => {
        call.answer(audioStream);
        call.on("stream", (userStream) => {
          addAudioStream(userStream);
        });
      });

      socketRef.current?.on("user-connected", (userId) => {
        const call = myPeer.call(userId, audioStream);
        call.on("stream", (userStream) => {
          addAudioStream(userStream);
        });
        setPeers((prev) => ({ ...prev, [userId]: call }));
      });
    });

    socketRef.current?.on("user-disconnected", (userId) => {
      if (peers[userId]) {
        peers[userId].close();
      }
    });

    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const [isMuted, setIsMuted] = useState(false);

  const toggleMute = () => {
    if (!stream) return; // ✅ Ensure stream is not null before accessing
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length > 0) {
      const newMuteState = !audioTracks[0].enabled;
      audioTracks[0].enabled = newMuteState;
      setIsMuted(!newMuteState);
    }
  };

  function joinEventhandler({ clients, username, socketId }: any) {
    setClients(clients);
    if (username !== name) {
      toast.success(`${username} joined the room`);
      socketRef.current?.emit(ACTIONS.SYNC_CODE, {
        socketId,
        html,
        css,
        js,
      });
    }
  }

  function handleErrors(e?: Error) {
    console.log("Socket error", e && e?.message);
    toast.error("Socket Connection failed, try again later");
    setTimeout(() => {
      //   router.push("/");
    }, 4000);
  }
  async function copyRoomId() {
    console.log("From cccc", html, css, js);

    try {
      await navigator.clipboard.writeText(roomId as string);
      toast.success("Room ID has been copied to your clipboard");
    } catch (err) {
      toast.error("Could not copy the Room ID");
      console.error(err);
    }
  }

  function leaveRoom() {
    router.push("/");
  }

  useEffect(() => {
    if (!name || name === "") {
      router.push("/");
    }

    const init = async () => {
      socketRef.current = await initSocket();
      socketRef.current.on("connect_error", (err) => handleErrors(err));
      socketRef.current.on("connect_failed", (err) => handleErrors(err));

      socketRef.current.emit(ACTIONS.JOIN, {
        roomId,
        username: name ? name : "",
      });

      socketRef.current.on(ACTIONS.JOINED, joinEventhandler);

      socketRef.current.on(ACTIONS.CODE_CHANGE, ({ html, css, js }) => {
        setHtml(html);
        setCss(css);
        setJs(js);
      });

      socketRef.current.on(ACTIONS.DISCONNECTED, ({ username, socketId }) => {
        toast.success(`${username} has left the room`);
        // @ts-ignore
        setClients((prev) => prev.filter((c) => c.socketId !== socketId));
      });
    };

    init();

    return () => {
      socketRef.current?.disconnect();
      socketRef.current?.off(ACTIONS.JOINED);
      socketRef.current?.off(ACTIONS.DISCONNECTED);
    };
  }, []);

  const changeCode = () => {
    setSrcDoc(`
    <html>
      <style>
      ${css}</style>
      <body>${html}</body>
      <script>
      const originalLog = console.log;
      console.log = (...args) => {
        
        parent.window.postMessage({ type: 'log', args: args }, '*')
        originalLog(...args)
      };
      const originalWarn = console.warn;
      console.warn = (...args) => {
        
        parent.window.postMessage({ type: 'warn', args: args }, '*')
        originalWarn(...args)
      };
      const originalError= console.error;
      console.error = (...args) => {
        
        parent.window.postMessage({ type: 'error', args: args }, '*')
        originalError(...args)
      };
      window.onerror = function(msg, url, line){
        parent.window.postMessage({ type: 'error', args: msg, line: line}, '*')
      }
      ${js}</script>
    </html>
    `);
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      changeCode();
    }, 1000);
    return () => clearTimeout(timeout);
  }, []);

  const getCodeByFileName = (fileName: string): string => {
    let code = "";
    switch (fileName) {
      case "index.html":
        code = html;
        break;

      case "style.css":
        code = css;
        break;

      case "script.js":
        code = js;
        break;

      default:
        break;
    }
    return code;
  };
  const ChangeCodeByFileName = (fileName: string, value: string) => {
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
    <div className="flex flex-col space-y-10 bg-gradient-to-b from-purple-500 via-blue-500 to-black min-h-screen text-white justify-center items-center">
      <Head>
        <title>Editor | Code Here</title>
      </Head>
      <div className="flex-1 grid grid- grid-cols-editor ">
        <div className="flex flex-col h-screen justify-between">
          <div className="  flex-col ">
            <div className="flex items-center px-4 w-full h-32 ">
              <Image width={50} height={50} src="/logo-white.png" />
              <h1 className="font-extrabold text-2xl">Code Here</h1>
            </div>
            <hr />
            <div className="flex-col  my-4 w-full ">
              {Object.keys(dummyFilesData).map((keyName, i) => {
                // @ts-ignore
                let fileData = dummyFilesData[keyName];

                return (
                  <div
                    key={fileData.language}
                    onClick={() => {
                      setActiveFile(fileData.name);
                    }}
                    className={
                      fileData.name === activeFile
                        ? fileNameBarClasses + "bg-purple"
                        : fileNameBarClasses
                    }
                  >
                    {/* <FontAwesomeIcon
                    color={fileData.iconColor}
                    icon={["fab", fileData.iconName as IconName]}
                  /> */}
                    <Image width="20px" height="20px" src={fileData.iconName} />
                    <p className="mx-4">{fileData.name}</p>
                  </div>
                );
              })}
            </div>
            <h3 className="mx-3 text-lg font-semibold mb-2">Connected</h3>
            <div className="px-2 w-full flex flex-wrap">
              {clientList.map((client: any) => (
                <ClientAvatar
                  key={client.socketId}
                  username={client.username}
                />
              ))}
              <p></p>
            </div>
            {/* Integrate voice chat here */}
            <button onClick={toggleMute} className="p-2 bg-blue-500 text-white rounded">
              {isMuted ? "Unmute" : "Mute"}
            </button>
          </div>
          <div className="mx-3">
            <button
              onClick={copyRoomId}
              className="w-full rounded-xl p-3 mb-2 font-bold bg-white text-black"
            >
              Copy ROOM ID
            </button>
            <button
              onClick={leaveRoom}
              className="w-full rounded-xl p-3 mb-2 font-bold bg-primary text-black"
            >
              Leave
            </button>
          </div>
        </div>
        <div style={{ height: "98vh" }} className=" grid grid-cols-2 ">
          <EditorComponent
            onClickFunc={() => {
              changeCode();
            }}
            onChange={(value) => {
              ChangeCodeByFileName(activeFile, value as string);
            }}
            code={getCodeByFileName(activeFile)}
            language={
              // @ts-ignore
              dummyFilesData[activeFile]?.language
            }
          />
          <div className="grid grid-rows-[75vh_55px]">
            <iframe
              srcDoc={srcDoc}
              className="flex w-full h-full bg-white"
            ></iframe>
            <div className="bg-bgdark">
              <ConsoleSection />
            </div>
          </div>
          { }
        </div>
      </div>
    </div>
  );
};

export default EditorContainer;
