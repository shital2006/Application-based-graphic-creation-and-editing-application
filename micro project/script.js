
const canvas = document.getElementById("canvas");
const NS = "http://www.w3.org/2000/svg";

const fillInput = document.getElementById("fillColor");
const strokeInput = document.getElementById("strokeColor");
const widthInput = document.getElementById("strokeWidth");
const strokeValue = document.getElementById("strokeValue");
const status = document.getElementById("status");

let currentTool = "select";
let selected = null;
let drawing = null;
let startPoint = null;
let moving = null;
let history = [];

const shapes = new Set([
    "rect", "circle", "line", "polygon", "text", "path"
]);

function createSVGElement(tag, attrs = {}) {
    const element = document.createElementNS(NS, tag);

    for (const [key, value] of Object.entries(attrs)) {
        element.setAttribute(key, value);
    }

    return element;
}

function remember() {
    history.push(
        Array.from(canvas.children)
            .filter(el => el.id !== "canvasBackground")
            .map(el => el.cloneNode(true))
    );

    if (history.length > 50) {
        history.shift();
    }
}

function undo() {
    if (history.length === 0) {
        status.textContent = "Nothing to undo";
        return;
    }

    canvas.querySelectorAll(".selection-box")
        .forEach(el => el.remove());

    canvas.querySelectorAll(".shape")
        .forEach(el => el.remove());

    const previous = history.pop();

    previous.forEach(el => {
        canvas.appendChild(el);
    });

    selected = null;
    status.textContent = "Last action undone";
}

function setTool(tool) {
    currentTool = tool;

    document.querySelectorAll(".tool").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.tool === tool
        );
    });

    status.textContent = "Tool: " + tool;
}

document.querySelectorAll(".tool").forEach(button => {
    button.addEventListener("click", () => {
        setTool(button.dataset.tool);

        if (currentTool === "text") {
            addText();
        }
    });
});

widthInput.addEventListener("input", () => {
    strokeValue.textContent = widthInput.value + " px";
});

function getPoint(event) {
    const point = canvas.createSVGPoint();

    point.x = event.clientX;
    point.y = event.clientY;

    const matrix = canvas.getScreenCTM();

    if (!matrix) {
        return { x: 0, y: 0 };
    }

    const result = point.matrixTransform(matrix.inverse());

    return {
        x: Math.max(0, Math.min(1000, result.x)),
        y: Math.max(0, Math.min(650, result.y))
    };
}

function applyStyle(element) {
    element.setAttribute("fill", fillInput.value);
    element.setAttribute("stroke", strokeInput.value);
    element.setAttribute("stroke-width", widthInput.value);
    element.setAttribute("stroke-linecap", "round");
    element.setAttribute("stroke-linejoin", "round");
}

function makeShape(tag) {
    const element = createSVGElement(tag);

    element.classList.add("shape");
    element.dataset.editable = "true";

    applyStyle(element);

    if (tag === "line") {
        element.setAttribute("fill", "none");
    }

    if (tag === "path") {
        element.setAttribute("fill", "none");
    }

    canvas.appendChild(element);
    return element;
}

function updateShape(element, start, end) {
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    const h = Math.abs(end.y - start.y);

    if (element.tagName === "rect") {
        element.setAttribute("x", x);
        element.setAttribute("y", y);
        element.setAttribute("width", w);
        element.setAttribute("height", h);
    }

    if (element.tagName === "circle") {
        element.setAttribute("cx", (start.x + end.x) / 2);
        element.setAttribute("cy", (start.y + end.y) / 2);
        element.setAttribute("r", Math.sqrt(w * w + h * h) / 2);
    }

    if (element.tagName === "line") {
        element.setAttribute("x1", start.x);
        element.setAttribute("y1", start.y);
        element.setAttribute("x2", end.x);
        element.setAttribute("y2", end.y);
    }

    if (element.tagName === "polygon") {
        const cx = (start.x + end.x) / 2;
        const cy = (start.y + end.y) / 2;
        const rx = w / 2;
        const ry = h / 2;

        const points = [];

        for (let i = 0; i < 10; i++) {
            const angle = -Math.PI / 2 + i * Math.PI / 5;
            const radius = i % 2 === 0 ? 1 : 0.42;

            points.push(
                `${cx + Math.cos(angle) * rx * radius},` +
                `${cy + Math.sin(angle) * ry * radius}`
            );
        }

        element.setAttribute("points", points.join(" "));
    }
}

function addText() {
    const value = prompt("Enter your text:");

    if (!value || !value.trim()) {
        setTool("select");
        return;
    }

    remember();

    const text = makeShape("text");

    text.setAttribute("x", 100);
    text.setAttribute("y", 100);
    text.setAttribute("font-size", "32");
    text.setAttribute("font-family", "Arial, sans-serif");
    text.setAttribute("fill", fillInput.value);
    text.setAttribute("stroke", "none");
    text.textContent = value.trim();

    selectShape(text);
    setTool("select");
}

function selectShape(element) {
    if (selected) {
        selected.classList.remove("selected");
    }

    selected = element;

    if (selected) {
        selected.classList.add("selected");

        const fill = selected.getAttribute("fill");
        const stroke = selected.getAttribute("stroke");
        const width = selected.getAttribute("stroke-width");

        if (fill && /^#[0-9a-f]{6}$/i.test(fill)) {
            fillInput.value = fill;
        }

        if (stroke && /^#[0-9a-f]{6}$/i.test(stroke)) {
            strokeInput.value = stroke;
        }

        if (width && Number(width) >= 1 && Number(width) <= 15) {
            widthInput.value = width;
            strokeValue.textContent = width + " px";
        }

        status.textContent = "Selected: " + selected.tagName;
    } else {
        status.textContent = "No object selected";
    }
}

function findShape(element) {
    while (element && element !== canvas) {
        if (
            element.classList &&
            element.classList.contains("shape")
        ) {
            return element;
        }

        element = element.parentNode;
    }

    return null;
}

canvas.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;

    const point = getPoint(event);
    const target = findShape(event.target);

    if (currentTool === "select") {
        if (target) {
            selectShape(target);

            if (target.tagName !== "text") {
                remember();

                moving = {
                    element: target,
                    start: point,
                    original: target.cloneNode(true)
                };

                canvas.setPointerCapture(event.pointerId);
            }
        } else {
            selectShape(null);
        }

        return;
    }

    if (currentTool === "text") {
        addText();
        return;
    }

    const tags = {
        rect: "rect",
        circle: "circle",
        line: "line",
        star: "polygon"
    };

    const tag = tags[currentTool];

    if (!tag) return;

    remember();

    drawing = makeShape(tag);
    startPoint = point;

    updateShape(drawing, startPoint, point);

    canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", event => {
    const point = getPoint(event);

    if (drawing && startPoint) {
        updateShape(drawing, startPoint, point);
        return;
    }

    if (moving) {
        const dx = point.x - moving.start.x;
        const dy = point.y - moving.start.y;

        const element = moving.element;
        const original = moving.original;

        if (element.tagName === "rect") {
            element.setAttribute(
                "x", Number(original.getAttribute("x")) + dx
            );

            element.setAttribute(
                "y", Number(original.getAttribute("y")) + dy
            );
        } else if (element.tagName === "circle") {
            element.setAttribute(
                "cx", Number(original.getAttribute("cx")) + dx
            );

            element.setAttribute(
                "cy", Number(original.getAttribute("cy")) + dy
            );
        } else if (element.tagName === "line") {
            ["x1", "x2"].forEach(key => {
                element.setAttribute(
                    key, Number(original.getAttribute(key)) + dx
                );
            });

            ["y1", "y2"].forEach(key => {
                element.setAttribute(
                    key, Number(original.getAttribute(key)) + dy
                );
            });
        } else if (element.tagName === "polygon") {
            const points = original.getAttribute("points")
                .trim()
                .split(/\s+/)
                .map(pair => {
                    const [x, y] = pair.split(",").map(Number);
                    return `${x + dx},${y + dy}`;
                });

            element.setAttribute("points", points.join(" "));
        }

        status.textContent = "Moving object...";
    }
});

function finishPointer() {
    if (drawing) {
        selectShape(drawing);
        drawing = null;
        startPoint = null;
        status.textContent = "Shape created";
    }

    if (moving) {
        moving = null;
        status.textContent = "Object moved";
    }
}

canvas.addEventListener("pointerup", finishPointer);
canvas.addEventListener("pointercancel", finishPointer);

document.getElementById("applyBtn").addEventListener("click", () => {
    if (!selected) {
        alert("Please select an object first.");
        return;
    }

    remember();
    applyStyle(selected);

    if (selected.tagName === "line" ||
        selected.tagName === "path") {
        selected.setAttribute("fill", "none");
    }

    if (selected.tagName === "text") {
        selected.setAttribute("fill", fillInput.value);
    }

    status.textContent = "Properties updated";
});

document.getElementById("deleteBtn").addEventListener("click", () => {
    if (!selected) {
        alert("Please select an object first.");
        return;
    }

    remember();
    selected.remove();
    selected = null;

    status.textContent = "Object deleted";
});

document.getElementById("clearBtn").addEventListener("click", () => {
    if (!confirm("Clear all drawings?")) return;

    remember();

    canvas.querySelectorAll(".shape").forEach(element => {
        element.remove();
    });

    selected = null;
    drawing = null;
    moving = null;

    status.textContent = "Canvas cleared";
});

document.getElementById("undoBtn").addEventListener("click", undo);

document.getElementById("saveBtn").addEventListener("click", () => {
    const exportCanvas = canvas.cloneNode(true);

    exportCanvas.querySelectorAll(".selected").forEach(element => {
        element.classList.remove("selected");
    });

    exportCanvas.querySelectorAll(".selection-box").forEach(element => {
        element.remove();
    });

    exportCanvas.setAttribute("xmlns", NS);
    exportCanvas.setAttribute("width", "1000");
    exportCanvas.setAttribute("height", "650");

    const source = new XMLSerializer().serializeToString(exportCanvas);

    const blob = new Blob(
        [source],
        { type: "image/svg+xml;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "my-vector-art.svg";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);

    status.textContent = "SVG exported successfully";
});
