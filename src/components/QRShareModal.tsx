import { QRCodeSVG } from "qrcode.react";

interface Props {
  url: string;
  onClose: () => void;
}

export default function QRShareModal({ url, onClose }: Props) {
  function copyLink() {
    navigator.clipboard.writeText(url);
    alert("링크가 복사되었습니다!");
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-2xl p-6 w-full max-w-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-center font-bold text-lg mb-4">친구 초대하기</h2>
        <div className="bg-white p-4 rounded-xl flex justify-center mb-4">
          <QRCodeSVG value={url} size={180} />
        </div>
        <button
          onClick={copyLink}
          className="w-full py-3 bg-amber-500 hover:bg-amber-400 rounded-xl font-bold text-black mb-2"
        >
          링크 복사
        </button>
        <button
          onClick={onClose}
          className="w-full py-3 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
