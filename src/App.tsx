import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import RoomPage from "./pages/RoomPage";
import JoinPage from "./pages/JoinPage";
import SettlePage from "./pages/SettlePage";
import ResultPage from "./pages/ResultPage";
import AdBanner from "./components/AdBanner";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-950 text-white">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/room/:roomId" element={<RoomPage />} />
          <Route path="/room/:roomId/join" element={<JoinPage />} />
          <Route path="/room/:roomId/settle" element={<SettlePage />} />
          <Route path="/room/:roomId/result" element={<ResultPage />} />
        </Routes>
        {/* 하단 광고 배너 */}
        <AdBanner />
      </div>
    </BrowserRouter>
  );
}
