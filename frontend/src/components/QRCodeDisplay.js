// src/components/QRCodeDisplay.js
// QR encodes an ENCRYPTED URL — the secretCode is NEVER embedded in the QR.
// It is printed separately under a scratch-off panel on the physical label.
import React, { useRef, useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'react-toastify';
import { encryptQR } from '../utils/qrEncryption';
import './QRCodeDisplay.css';

const APP_ORIGIN = process.env.REACT_APP_PUBLIC_URL?.replace(/\/$/, "") || window.location.origin;

const QRCodeDisplay = ({ productId, secretCode }) => {
    const qrRef = useRef();
    const rawUrl = `${APP_ORIGIN}/product/${productId}`;
    const [qrValue, setQrValue] = useState('');

    // Encrypt the URL before putting it into the QR
    useEffect(() => {
        encryptQR(rawUrl).then(setQrValue);
    }, [rawUrl]);

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
        navigator.clipboard.writeText(rawUrl);
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
                {qrValue ? (
                    <QRCodeSVG
                        value={qrValue}
                        size={150}
                        level="H"
                        includeMargin={true}
                        bgColor="#ffffff"
                        fgColor="#000000"
                    />
                ) : (
                    <div style={{ width: 150, height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: '#999' }}>
                        Encrypting…
                    </div>
                )}
            </div>
            <div className="qr-actions">
                <button className="btn btn-download" onClick={downloadQR} disabled={!qrValue}>
                    📥 Download QR
                </button>
                <button className="btn btn-copy" onClick={copyToClipboard}>
                    📋 Copy URL
                </button>
            </div>
            <p className="qr-info">
                🔒 Encrypted QR · Scan to view supply chain journey · Enter scratch code to verify authenticity
            </p>
        </div>
    );
};

export default QRCodeDisplay;
