// src/components/ProductJourneyQR.js
import React, { useRef, useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'react-toastify';
import { encryptQR } from '../utils/qrEncryption';
import './ProductJourneyQR.css';

const ProductJourneyQR = ({ productId, productName, journey }) => {
    const qrRef = useRef();
    const [qrValue, setQrValue] = useState('');

    // Create journey data for QR code
    const journeyData = {
        productId,
        productName,
        totalSteps: journey?.length || 0,
        currentStatus: journey?.[journey.length - 1]?.status || 'Created',
        journey: journey?.map(step => ({
            status: step.status,
            location: step.location,
            timestamp: step.timestamp,
            handler: step.handler
        })) || []
    };

    // Encrypt journey JSON before embedding in QR
    useEffect(() => {
        encryptQR(JSON.stringify(journeyData)).then(setQrValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productId, productName, JSON.stringify(journey)]);

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
            downloadLink.download = `product-${productId}-journey-qr.png`;
            downloadLink.href = pngFile;
            downloadLink.click();

            toast.success('Journey QR Code downloaded!');
        };

        img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
    };

    const copyJourneyData = () => {
        const data = JSON.stringify(journeyData, null, 2);
        navigator.clipboard.writeText(data);
        toast.info('Journey data copied to clipboard!');
    };

    return (
        <div className="journey-qr-container glass">
            <h3>🗺️ Product Journey QR Code</h3>

            <div className="journey-summary">
                <div className="summary-item">
                    <span className="summary-label">Total Steps:</span>
                    <span className="summary-value">{journeyData.totalSteps}</span>
                </div>
                <div className="summary-item">
                    <span className="summary-label">Current Status:</span>
                    <span className={`summary-value status-${journeyData.currentStatus.toLowerCase()}`}>
                        {journeyData.currentStatus}
                    </span>
                </div>
            </div>

            <div className="qr-code-wrapper" ref={qrRef}>
                {qrValue ? (
                    <QRCodeSVG
                        value={qrValue}
                        size={200}
                        level="H"
                        includeMargin={true}
                        bgColor="#ffffff"
                        fgColor="#000000"
                    />
                ) : (
                    <div style={{ width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: '#999' }}>
                        Encrypting…
                    </div>
                )}
            </div>

            <div className="qr-actions">
                <button className="btn btn-download" onClick={downloadQR} disabled={!qrValue}>
                    📥 Download Journey QR
                </button>
                <button className="btn btn-copy" onClick={copyJourneyData}>
                    📋 Copy Journey Data
                </button>
            </div>

            <p className="qr-info">
                🔒 Encrypted · Scan with our system to view the complete product journey
            </p>
        </div>
    );
};

export default ProductJourneyQR;
