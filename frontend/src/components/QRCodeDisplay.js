// src/components/QRCodeDisplay.js
// QR encodes a URL only — the secretCode is NEVER embedded in the QR.
// It is printed separately under a scratch-off panel on the physical label.
import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'react-toastify';
import './QRCodeDisplay.css';

const APP_ORIGIN = process.env.REACT_APP_PUBLIC_URL?.replace(/\/$/, "") || window.location.origin;

const QRCodeDisplay = ({ productId, secretCode }) => {
    const qrRef = useRef();
    // QR points to the product page — journey is fetched live from blockchain on scan
    const qrUrl = `${APP_ORIGIN}/product/${productId}`;

    const downloadQR = () => {
        const svg = qrRef.current.querySelector('svg');
        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            const pngFile = canvas.toDataURL('image/png');

            const downloadLink = document.createElement('a');
            downloadLink.download = `product-${productId}-qr.png`;
            downloadLink.href = pngFile;
            downloadLink.click();

            toast.success('QR Code downloaded successfully!');
        };

        img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(qrUrl);
        toast.info('Product URL copied to clipboard!');
    };

    return (
        <div className="qr-code-container glass">
            <h3>🔐 Product QR Code</h3>

            {/* Product Information */}
            <div className="product-info-display">
                <div className="info-row">
                    <span className="info-label">Product ID:</span>
                    <span className="info-value-display">{productId}</span>
                </div>
                <div className="info-row">
                    <span className="info-label">Scratch-off Code:</span>
                    <span className="info-value-display secret-code">{secretCode}</span>
                    <span style={{ fontSize: "0.7rem", color: "#f59e0b", marginLeft: "0.5rem" }}>
                        ⚠ Print under scratch-off label only — do not put on QR
                    </span>
                </div>
            </div>

            <div className="qr-code-wrapper" ref={qrRef}>
                <QRCodeSVG
                    value={qrUrl}
                    size={150}
                    level="H"
                    includeMargin={true}
                    bgColor="#ffffff"
                    fgColor="#000000"
                />
            </div>
            <div className="qr-actions">
                <button className="btn btn-download" onClick={downloadQR}>
                    📥 Download QR
                </button>
                <button className="btn btn-copy" onClick={copyToClipboard}>
                    📋 Copy URL
                </button>
            </div>
            <p className="qr-info">
                Scan to view supply chain journey · Enter scratch code to verify authenticity
            </p>
        </div>
    );
};

export default QRCodeDisplay;
