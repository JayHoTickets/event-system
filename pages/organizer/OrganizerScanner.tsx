
import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { verifyTicket, checkInTicket } from '../../services/mockBackend';
import { Ticket, Order } from '../../types';
import { ArrowLeft, CheckCircle, AlertTriangle, Scan, RefreshCw, Camera, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const OrganizerScanner: React.FC = () => {
  const navigate = useNavigate();
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const preferredDeviceIdRef = useRef<string | null>(null);
    const permissionStreamRef = useRef<MediaStream | null>(null);
  
  // State
  const [scanResult, setScanResult] = useState<{ ticket: Ticket, order: Order } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // Use ref for debouncing to avoid stale closures in the scanner callback
  const lastScannedCodeRef = useRef<string | null>(null);

  useEffect(() => {
    // Only initialize if isScanning is true
    if (isScanning) {
        // Short timeout to ensure DOM element exists
        const timeoutId = setTimeout(() => {
            (async () => {
                if (!scannerRef.current) {
                    const html5QrCode = new Html5Qrcode("reader");
                    scannerRef.current = html5QrCode;

                    // Prefer explicit deviceId when available (we obtained it earlier after permission),
                    // otherwise ask for environment facing camera.
                    const cameraConstraints: any = preferredDeviceIdRef.current
                        ? { deviceId: { exact: preferredDeviceIdRef.current } }
                        : { facingMode: { ideal: "environment" } };

                    try {
                        await html5QrCode.start(
                            cameraConstraints,
                            { fps: 10, qrbox: { width: 250, height: 250 } },
                            (decodedText: string) => onScanSuccess(decodedText),
                            (errorMessage: any) => onScanFailure(errorMessage)
                        );
                    } catch (err: any) {
                        setError(err?.message || 'Failed to start camera');
                        // cleanup on failure
                        if (scannerRef.current) {
                            try { await scannerRef.current.stop(); } catch(_) {}
                            scannerRef.current = null;
                        }
                    }
                }
            })();
        }, 100);

        return () => {
            clearTimeout(timeoutId);
            if (scannerRef.current) {
                scannerRef.current.stop().catch(err => console.error("Failed to stop scanner", err));
                scannerRef.current = null;
            }
            // stop any temporary permission stream
            if (permissionStreamRef.current) {
                permissionStreamRef.current.getTracks().forEach(t => t.stop());
                permissionStreamRef.current = null;
            }
        };
    } else {
        // Cleanup if scanning is turned off
        if (scannerRef.current) {
            scannerRef.current.stop().catch(err => console.error("Failed to stop scanner", err));
            scannerRef.current = null;
        }
        if (permissionStreamRef.current) {
            permissionStreamRef.current.getTracks().forEach(t => t.stop());
            permissionStreamRef.current = null;
        }
    }
  }, [isScanning]);

  const onScanSuccess = async (decodedText: string) => {
    if (decodedText === lastScannedCodeRef.current) return; // Debounce
    
    lastScannedCodeRef.current = decodedText;
    setError(null);
    setLoading(true);

    try {
      const data = await verifyTicket(decodedText);
      if (data.valid) {
                setScanResult({ ticket: data.ticket, order: data.order });
                // Stop scanning automatically on success and hide camera
                setIsScanning(false);
      } else {
        setError("Invalid Ticket Code");
        setScanResult(null);
      }
    } catch (err: any) {
      setError(err.message || "Failed to verify ticket");
      setScanResult(null);
    } finally {
      setLoading(false);
    }
  };

  const onScanFailure = (error: any) => {
    // console.warn(`Code scan error = ${error}`);
  };

  const handleCheckIn = async (ticketId: string, checkedIn: boolean) => {
    try {
      const res = await checkInTicket(ticketId, checkedIn);
      // Update local state
      if (scanResult) {
        const updatedTickets = scanResult.order.tickets.map(t => 
           t.id === ticketId ? { ...t, checkedIn, checkInDate: checkedIn ? new Date().toISOString() : undefined } : t
        );
        setScanResult({
            ...scanResult,
            order: { ...scanResult.order, tickets: updatedTickets },
            // If the primary scanned ticket was updated, reflect it
            ticket: scanResult.ticket.id === ticketId ? { ...scanResult.ticket, checkedIn } : scanResult.ticket
        });
      }
    } catch (err: any) {
      alert("Failed to update check-in status: " + err.message);
    }
  };

  const handleReset = () => {
      setScanResult(null);
      setError(null);
      lastScannedCodeRef.current = null;
      // Restart scanning for next ticket
      setIsScanning(true);
  };

  const toggleCamera = () => {
            if (isScanning) {
                    setIsScanning(false);
                    setScanResult(null);
                    setError(null);
                    lastScannedCodeRef.current = null;
            } else {
                    // On mobile browsers calling getUserMedia will trigger permission popup and allow us
                    // to select the back camera. We request permission first, then start the scanner.
                    (async () => {
                            const ok = await requestCameraPermissionAndSelectBack();
                            if (ok) setIsScanning(true);
                    })();
            }
  };

    // Request camera permission and determine preferred back camera deviceId.
    const requestCameraPermissionAndSelectBack = async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setError('Camera not supported in this browser');
            return false;
        }

        try {
            // Ask for environment-facing camera to trigger permission prompt and let the browser prefer back camera
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
            permissionStreamRef.current = stream;

            // Enumerate devices now that we have permission to read labels
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(d => d.kind === 'videoinput');

            // Try to find a device whose label suggests it's the back/rear camera
            let backDevice = videoDevices.find(d => /back|rear|environment|traseira|trasera/i.test(d.label));
            if (!backDevice && videoDevices.length > 1) {
                // If we couldn't match by label, pick the last device (common pattern where rear camera is last)
                backDevice = videoDevices[videoDevices.length - 1];
            }

            preferredDeviceIdRef.current = backDevice ? backDevice.deviceId : (videoDevices[0]?.deviceId ?? null);

            // Stop the temporary stream; Html5Qrcode will open its own stream using the chosen device
            stream.getTracks().forEach(t => t.stop());
            permissionStreamRef.current = null;

            return true;
        } catch (err: any) {
            setError(err?.message || 'Camera permission denied');
            return false;
        }
    };

    // Format seat label for display: hide noisy GA placeholder values
    const formatSeatLabel = (label?: string) => {
        if (!label) return '—';
        const normalized = label.trim().toLowerCase();
        if (/^gaany$/i.test(normalized) || /^ga$/i.test(normalized) || /general admission/i.test(normalized)) return '—';
        return label;
    };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
       <button onClick={() => navigate('/organizer')} className="flex items-center text-slate-500 hover:text-slate-800 mb-6">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
        </button>

        <h1 className="text-3xl font-bold text-slate-900 mb-8 flex items-center">
            <Scan className="w-8 h-8 mr-3 text-indigo-600" /> Ticket Scanner
        </h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Scanner Column (hidden when a scan result is present) */}
            {!scanResult && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                {!isScanning ? (
                    <div className="flex flex-col items-center justify-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                        <Camera className="w-16 h-16 text-slate-300 mb-4" />
                        <p className="text-slate-500 mb-6">Camera is currently off</p>
                        <button 
                            onClick={toggleCamera}
                            className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-indigo-700 transition flex items-center shadow-md"
                        >
                            <Camera className="w-5 h-5 mr-2" /> Start Camera
                        </button>
                    </div>
                ) : (
                    <div className="relative">
                        <div id="reader" className="w-full overflow-hidden rounded-lg"></div>
                        <button 
                            onClick={toggleCamera}
                            className="mt-4 w-full flex items-center justify-center bg-red-50 text-red-600 px-4 py-2 rounded-lg font-bold hover:bg-red-100 transition border border-red-200"
                        >
                            <X className="w-4 h-4 mr-2" /> Stop Camera
                        </button>
                        <p className="text-xs text-slate-400 text-center mt-2">Point camera at QR code</p>
                    </div>
                )}
            </div>
            )}

            {/* Results Column */}
            <div className="space-y-6">
                {loading && (
                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-center text-slate-500 animate-pulse">
                        Verifying ticket...
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 p-6 rounded-xl border border-red-200 text-center animate-in fade-in">
                        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-2" />
                        <h3 className="text-lg font-bold text-red-800">Scan Failed</h3>
                        <p className="text-red-600">{error}</p>
                        <button onClick={handleReset} className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-medium">
                            Dismiss
                        </button>
                    </div>
                )}

                {scanResult && !loading && (
                    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                        {/* Header based on Status */}
                        <div className={`p-6 text-center ${scanResult.ticket.checkedIn ? 'bg-yellow-50 border-b border-yellow-100' : 'bg-green-50 border-b border-green-100'}`}>
                             {scanResult.ticket.checkedIn ? (
                                <>
                                    <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-2" />
                                    <h2 className="text-2xl font-bold text-yellow-800">Already Checked In</h2>
                                    <p className="text-yellow-700">Scanned at: {scanResult.ticket.checkInDate ? new Date(scanResult.ticket.checkInDate).toLocaleTimeString() : 'Unknown'}</p>
                                </>
                             ) : (
                                <>
                                    <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-2" />
                                    <h2 className="text-2xl font-bold text-green-800">Valid Ticket</h2>
                                    <p className="text-green-700">Ready for entry</p>
                                </>
                             )}
                        </div>

                        {/* Ticket Details */}
                        <div className="p-6">
                            <h3 className="font-bold text-lg text-slate-900 mb-4">{scanResult.ticket.eventTitle}</h3>
                            
                            <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                                <div>
                                    <span className="block text-slate-500">Customer</span>
                                    <span className="font-medium text-slate-900">{scanResult.order.customerName}</span>
                                </div>
                                <div>
                                    <span className="block text-slate-500">Seat</span>
                                        <span className="font-bold text-xl text-slate-900">{formatSeatLabel(scanResult.ticket.seatLabel)}</span>
                                </div>
                                <div>
                                    <span className="block text-slate-500">Ticket Type</span>
                                    <span className="font-medium text-slate-900">{scanResult.ticket.ticketType || 'Standard'}</span>
                                </div>
                                <div>
                                    <span className="block text-slate-500">Price</span>
                                    <span className="font-medium text-slate-900">${scanResult.ticket.price}</span>
                                </div>
                            </div>

                            {/* Main Check-In Button */}
                            <button
                                onClick={() => handleCheckIn(scanResult.ticket.id, !scanResult.ticket.checkedIn)}
                                className={`w-full py-4 rounded-xl font-bold text-lg shadow-md transition-all transform active:scale-95 ${
                                    scanResult.ticket.checkedIn 
                                    ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' 
                                    : 'bg-green-600 text-white hover:bg-green-700'
                                }`}
                            >
                                {scanResult.ticket.checkedIn ? 'Undo Check-in' : 'CHECK IN'}
                            </button>
                             <div className="p-3 bg-slate-100 text-center">
                    <button onClick={handleReset} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Scan Next Ticket</button>
                </div>
                        </div>

                        {/* Other Seats in Order (Group) */}
                        <div className="bg-slate-50 p-6 border-t border-slate-200">
                             <div className="flex justify-between items-center mb-4">
                                 <h4 className="font-bold text-slate-700">Other Tickets in Order ({scanResult.order.tickets.length})</h4>
                                 <span className="text-xs text-slate-400 font-mono">{scanResult.order.id}</span>
                             </div>
                             
                             <div className="space-y-2 max-h-60 overflow-y-auto">
                                 {scanResult.order.tickets.map(t => (
                                     <div key={t.id} className={`flex items-center justify-between p-3 rounded-lg border ${t.id === scanResult.ticket.id ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-300' : 'bg-white border-slate-200'}`}>
                                         <div>
                                             <div className="font-bold text-slate-800">{formatSeatLabel(t.seatLabel)}</div>
                                             <div className="text-xs text-slate-500">{t.ticketType}</div>
                                         </div>
                                         {t.checkedIn ? (
                                             <button 
                                                onClick={() => handleCheckIn(t.id, false)}
                                                className="flex items-center text-green-600 text-xs font-bold bg-green-50 px-2 py-1 rounded hover:bg-green-100"
                                             >
                                                 <CheckCircle className="w-3 h-3 mr-1" /> In
                                             </button>
                                         ) : (
                                             <button 
                                                onClick={() => handleCheckIn(t.id, true)}
                                                className="flex items-center text-slate-400 text-xs font-bold hover:text-green-600 hover:bg-green-50 px-2 py-1 rounded"
                                             >
                                                 <CheckCircle className="w-3 h-3 mr-1" /> Check In
                                             </button>
                                         )}
                                     </div>
                                 ))}
                             </div>
                        </div>

                        <div className="bg-slate-100 p-4 text-center">
                            <button onClick={handleReset} className="text-slate-500 hover:text-indigo-600 flex items-center justify-center mx-auto text-sm font-medium">
                                <RefreshCw className="w-4 h-4 mr-2" /> Scan Next Ticket
                            </button>
                        </div>
                    </div>
                )}

                {!scanResult && !loading && !error && !isScanning && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 p-12 border-2 border-dashed border-slate-200 rounded-xl">
                        <Scan className="w-16 h-16 mb-4 opacity-50" />
                        <p>Waiting for camera...</p>
                    </div>
                )}

                {!scanResult && !loading && !error && isScanning && (
                    <div className="h-full flex flex-col items-center justify-center text-indigo-400 p-12 border-2 border-dashed border-indigo-200 bg-indigo-50/50 rounded-xl animate-pulse">
                        <Scan className="w-16 h-16 mb-4" />
                        <p>Scanning...</p>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default OrganizerScanner;
