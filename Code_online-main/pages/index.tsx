import type { NextPage } from "next";
import Head from "next/head";
import Image from "next/image";
import PrimaryButton from "../components/Button";
import JoinRoomDialogue from "../components/joinroomDialogue";
import Navbar from "../components/Navbar";

const Home: NextPage = () => {
  return (
    <div className="flex flex-col space-y-10 bg-gradient-to-r from-cyan-400 to-blue-700 min-h-screen text-white justify-center items-center">
      <Head>
        <title>COLLABORATIVE CODING PLATFORM</title>
        <meta
          name=""
          content=""
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Navbar />
      <div className="flex justify-center items-center mx-5 space-x-8">
        <div className=" flex flex-col justify-center items-center space-y-4 ">
          <h1 className="font-extrabold text-5xl md:text-6xl text-center">
            Hello{" "} 
            <span className="text-transparent bg-clip-text bg-gradient-to-br from-purple-500 via-black to-black">
              World!!
            </span>
          </h1>

          <div>
            <JoinRoomDialogue />
          </div>
        </div>

        <div className=" rounded-lg border-2 overflow-hidden">
          <Image
            src="/front.png"
            width="850px"
            className="aspect-square"
            height="500px"
          />
        </div>
      </div>


    </div>
  );
};

export default Home;
