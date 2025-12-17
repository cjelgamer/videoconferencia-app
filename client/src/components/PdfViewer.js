import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// Worker setup for pdfjs-dist
// Using CDN to ensure correct version and headers. Use .mjs for module support in v5+
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

// Polyfill for Promise.withResolvers (required for pdfjs-dist v5+)
if (typeof Promise.withResolvers === 'undefined') {
    Promise.withResolvers = function () {
        let resolve, reject;
        const promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });
        return { promise, resolve, reject };
    };
}

const PdfViewer = ({
    fileUrl,
    pageNumber,
    scale = 1.0,
    onPageLoadSuccess,
    onPageLoadError,
    whiteboardLines = [], // Default to empty array
    onDraw,
    canDraw,
    containerWidth
}) => {
    const canvasRef = useRef(null);
    const whiteboardRef = useRef(null);
    const [renderTask, setRenderTask] = useState(null);
    const [drawing, setDrawing] = useState(false);
    const [lastPos, setLastPos] = useState(null);
    const [viewport, setViewport] = useState(null);
    const [pageError, setPageError] = useState(null);

    // Load and render PDF page
    useEffect(() => {
        let active = true;

        const renderPage = async () => {
            if (!fileUrl) return;

            try {
                // Clear error
                setPageError(null);

                const loadingTask = pdfjsLib.getDocument(fileUrl);
                // Wait for PDF to load info
                const pdf = await loadingTask.promise;

                if (!active) return;

                console.log(`PdfViewer: Loaded. Pages: ${pdf.numPages}, Requesting: ${pageNumber}`);

                // Validation
                const safePageNum = Math.min(Math.max(1, parseInt(pageNumber) || 1), pdf.numPages);

                const page = await pdf.getPage(safePageNum);

                if (!active) return;

                // Calculate scale to fit container width
                const originalViewport = page.getViewport({ scale: 1 });
                const desiredScale = containerWidth ? (containerWidth / originalViewport.width) : 1;
                const newViewport = page.getViewport({ scale: desiredScale });
                setViewport(newViewport);

                const canvas = canvasRef.current;
                const context = canvas.getContext('2d');
                canvas.height = newViewport.height;
                canvas.width = newViewport.width;

                // Resize whiteboard canvas to match
                if (whiteboardRef.current) {
                    whiteboardRef.current.height = newViewport.height;
                    whiteboardRef.current.width = newViewport.width;
                }

                const renderContext = {
                    canvasContext: context,
                    viewport: newViewport,
                };

                if (renderTask) {
                    await renderTask.promise; // Wait for previous render to cancel or finish ? 
                    // Actually pdfjs cancels automatically if you call cancel()
                    // but here we just store the task.
                }

                const task = page.render(renderContext);
                setRenderTask(task);

                await task.promise;

                if (onPageLoadSuccess) onPageLoadSuccess(pdf);

            } catch (error) {
                if (!active) return;
                console.error("Error rendering PDF page:", error);
                setPageError(error.message || "Error cargando PDF");
                if (onPageLoadError) onPageLoadError(error);
            }
        };

        renderPage();

        return () => {
            active = false;
            if (renderTask) {
                renderTask.cancel();
            }
        };
    }, [fileUrl, pageNumber, containerWidth, scale]);

    // Render Whiteboard Lines
    useEffect(() => {
        if (!whiteboardRef.current || !viewport) return;

        const canvas = whiteboardRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear before redraw

        // Draw all lines
        whiteboardLines.forEach(line => {
            if (line.points.length < 2) return;

            ctx.beginPath();
            ctx.strokeStyle = line.color;
            ctx.lineWidth = line.width; // We might need to scale width relative to viewport
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Start
            // Points are stored ideally as normalized [0-1] coordinates relative to PDF size
            // But implementation simplicity: stored as raw relative to some standard, OR we normalize now.
            // Let's assume points are normalized [x, y, x, y...] (0-1) to handle resizing responsiveness

            // If we store raw pixels, resizing breaks it.
            // PROPOSAL: Store normalized coordinates [0-1].

            const w = canvas.width;
            const h = canvas.height;

            ctx.moveTo(line.points[0] * w, line.points[1] * h);

            for (let i = 2; i < line.points.length; i += 2) {
                ctx.lineTo(line.points[i] * w, line.points[i + 1] * h);
            }
            ctx.stroke();
        });

    }, [whiteboardLines, viewport]);


    // Drawing Handlers
    const getCoords = (e) => {
        const canvas = whiteboardRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;

        // Normalize relative to visual size (rect)
        return {
            x: x / rect.width,
            y: y / rect.height
        };
    }

    const startDrawing = (e) => {
        if (!canDraw) return;
        setDrawing(true);
        const { x, y } = getCoords(e);
        setLastPos({ x, y });
    };

    const draw = (e) => {
        if (!drawing || !canDraw || !lastPos) return;
        e.preventDefault(); // Prevent scroll on touch

        const currentPos = getCoords(e);

        // Emit single segment or build a line? 
        // Emitting segments (line from A to B) is better for real-time.
        // BUT we need to associate them to a single "stroke" if we want undo later.
        // For now, simpler: Emit 'stroke-segment' or just update local state and emit full line on mouseUp?
        // Real-time collaboration needssegments.

        // Strategy: We draw locally immediately. We verify 'line' in backend is full array.
        // Let's emit the WHOLE line? No, too big.
        // Let's emit a segment. 'whiteboard-draw' event will take a full line object?
        // Actually simpler for MVP: Emit the single small line segment as a "Line" object.

        const newLine = {
            points: [lastPos.x, lastPos.y, currentPos.x, currentPos.y],
            color: '#ff0000', // Default red
            width: 3,
            tool: 'pen'
        };

        if (onDraw) onDraw(newLine);

        setLastPos(currentPos);
    };

    const stopDrawing = () => {
        setDrawing(false);
        setLastPos(null);
    };

    if (pageError) {
        return (
            <div style={{
                color: 'white',
                background: '#dc2626',
                padding: '20px',
                borderRadius: '8px',
                textAlign: 'center',
                margin: '20px'
            }}>
                <h3>Error visualizando PDF</h3>
                <p>{pageError}</p>
                <code style={{ fontSize: '0.8rem', background: 'rgba(0,0,0,0.2)', padding: '4px' }}>{fileUrl}</code>
            </div>
        );
    }

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <canvas
                ref={canvasRef}
                style={{ display: 'block', width: '100%' }}
            />
            <canvas
                ref={whiteboardRef}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    cursor: canDraw ? 'crosshair' : 'default',
                    touchAction: 'none'
                }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
            />
        </div>
    );
};

export default PdfViewer;
