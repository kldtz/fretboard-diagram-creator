function setAttributes(elem, attrs) {
    for (var idx in attrs) {
        if ((idx === 'styles' || idx === 'style') && typeof attrs[idx] === 'object') {
            const styles = [];
            for (var prop in attrs[idx]) { styles.push(`${prop}: ${attrs[idx][prop]};`); }
            elem.setAttribute('style', styles.join(' '));
        } else if (idx === 'html') {
            elem.innerHTML = attrs[idx];
        } else {
            elem.setAttribute(idx, attrs[idx]);
        }
    }
}

function generateClassValue(elem, classes) {
    var classValues = elem.className.baseVal.split(" ");
    if ('type' in classes) {
        classValues[0] = classes.type;
    }
    if ('color' in classes) {
        classValues[1] = classes.color;
    }
    if ('visibility' in classes) {
        classValues[2] = classes.visibility;
    }
    return classValues.join(' ');
}

function createSvgElement(tag, attributes = null) {
    const elem = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (typeof attributes === 'object') {
        setAttributes(elem, attributes);
    }
    return elem;
}


class Fretboard {
    constructor(opts) {
        this.svg = opts.svg;
        this.consts = {
            offsetX: 40,
            offsetY: 30,
            stringIntervals: [24, 19, 15, 10, 5, 0],
            markers: [3, 5, 7, 9, 12, 15, 17, 19, 21],
            fretWidth: 70,
            stringSpacing: 40,
            minStringSize: 0.2,
            circleRadius: 18,
            notes: [['E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C', 'C#', 'D', 'D#'],
                    ['E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B', 'C', 'Db', 'D', 'Eb']],
            sign: ['♯', '♭'],
        };
        this.consts.numStrings = this.consts.stringIntervals.length;
        this.consts.fretHeight = (this.consts.numStrings - 1) * this.consts.stringSpacing;

        this.state = {
            selected: null,
            visibility: 'transparent',
            startFret: 0,
            endFret: 12,
            enharmonic: 0
        };

        // Set end fret according to viewport width
        this.state.endFret = Math.min(Math.floor((window.innerWidth - 2 * this.consts.offsetX ) / this.consts.fretWidth), 12);
        opts.endFret.value = this.state.endFret;

        this.computeDependents();

        this.data = {};

        this.draw();
    }

    computeDependents() {
        this.state.numFrets = this.state.endFret - this.state.startFret;
        this.state.fretboardWidth = this.consts.fretWidth * this.state.numFrets;
    }

    toggleEnharmonic() {
        const untoggledEnharmonic = this.state.enharmonic;
        this.state.enharmonic = (untoggledEnharmonic + 1) % 2;
        this.erase();
        this.draw();
        return this.consts.sign[untoggledEnharmonic];
    }

    setFretWindow(fretWindow) {
        const start = 'start' in fretWindow ? fretWindow.start : this.state.startFret;
        const end = 'end' in fretWindow ? fretWindow.end : this.state.endFret;
        this.erase();
        if (start < 0 || start > 22 || end < 1 || end > 22) {
            this.drawError("Invalid fret value(s)!");
            return;
        }
        if (end <= start) {
            this.drawError("End fret must not be smaller than start fret!");
            this.state.startFret = start;
            this.state.endFret = end;
            return;
        }
        if (end - start > 16) {
            this.drawError("Maximal number of displayable frets is 16, <br/> e.g., 1st to 16th or 4th to 19th!");
            this.state.startFret = start;
            this.state.endFret = end;
            return;
        }

        this.state.startFret = start;
        this.state.endFret = end;

        this.computeDependents();
        this.draw();
    }

    drawError(message) {
        const text = createSvgElement('text', {
            x: 400,
            y: 140,
            class: 'error',
        });
        text.innerHTML = message;
        this.svg.appendChild(text);
        setAttributes(this.svg, {
            width: 800,
        });
    }

    draw() {
        this.drawFrets();
        this.drawMarkers();
        this.drawStrings();
        this.drawNotes();
        this.addEditableDiv();

        // adjust diagram width to number of selected frets
        setAttributes(this.svg, {
            width: this.state.fretboardWidth + 2 * this.consts.offsetX,
        })

        this.svg.addEventListener('click', () => {
            if (this.state.selected) {
                this.updateNote(this.state.selected, {
                    visibility: 'visible',
                });
                this.state.selected = null;
            }
        });

        document.addEventListener('keydown', (event) => {
            if (!this.state.selected || !event.code) {
                return;
            }
            const selected = this.state.selected;
            switch (event.code) {
                case 'Backspace':
                case 'Delete':
                    this.deleteNote()
                    break;
                case 'KeyB':
                    this.updateNote(selected, { color: "blue" });
                    break;
                case 'KeyD':
                    this.updateNote(selected, { color: "black" });
                    break;
                case 'KeyG':
                    this.updateNote(selected, { color: "green" });
                    break;
                case "KeyW":
                    this.updateNote(selected, { color: "white" });
                    break;
                case "KeyR":
                    this.updateNote(selected, { color: "red" });
                    break;
            }
        })
    }

    deleteNote() {
        // reset text
        const selected = this.state.selected;
        const text = selected.lastChild;
        if (text) {
            text.innerHTML = text.getAttribute('data-note');
        }
        this.updateNote(selected, { 
            color: "white", visibility: this.state.visibility 
        });
        this.state.selected = null;
    }

    updateColor(event) {
        this.updateNote(this.state.selected, { 
            color: event.currentTarget.getAttribute("title") 
        });
    }

    drawFrets() {
        var pathSegments = ["M " + this.consts.offsetX + " " + this.consts.offsetY];
        for (let i = this.state.startFret; i < (this.state.endFret + 1); i++) {
            let factor = (i - this.state.startFret) % 2 == 0 ? 1 : -1;
            pathSegments.push("v " + (factor) * this.consts.fretHeight);
            pathSegments.push("m " + this.consts.fretWidth + " " + 0);
        }
        const path = pathSegments.join(" ");


        const frets = createSvgElement('path', {
            'class': 'frets',
            'd': path,
        });
        this.svg.appendChild(frets);
    }

    drawMarkers() {
        const markers = createSvgElement('g', {
            class: 'markers'
        });
        const filteredMarkers = this.consts.markers
            .filter(i => i > this.state.startFret && i <= this.state.endFret);
        for (let i of filteredMarkers) {
            const marker = createSvgElement('text', {
                class: 'marker',
                x: this.consts.offsetX + (i - 1 - this.state.startFret) * this.consts.fretWidth + (this.consts.fretWidth / 2),
                y: this.consts.offsetY + this.consts.fretHeight + this.consts.stringSpacing,
            });
            marker.innerHTML = i;
            markers.appendChild(marker);
        }
        this.svg.appendChild(markers);
    }

    drawStrings() {
        this.strings = createSvgElement('g', {
            'class': 'strings',
        })
        this.svg.appendChild(this.strings);
        for (let i = 0; i < this.consts.numStrings; i++) {
            let path = "M " + this.consts.offsetX + " " + (this.consts.offsetY + i * this.consts.stringSpacing) + " h " + this.state.fretboardWidth;
            const string = createSvgElement('path', {
                'class': 'string',
                'd': path,
                'styles': {
                    'stroke-width': this.consts.minStringSize * (i + 1),
                }
            });
            this.strings.appendChild(string);
        }
    }

    drawNote(noteId, x, y, noteName, isOpen) {
        const note = createSvgElement('g', {
            'id': noteId,
            'transform': "translate(" + x + "," + y + ")",
            'data-x': x,
            'data-y': y,
        });
        this.notes.appendChild(note);
        note.addEventListener("click", (event) => this.noteClickHandler(event));
        note.addEventListener("dblclick", (event) => this.noteDoubleClickHandler(event));

        const circle = createSvgElement('circle', {
            'r': this.consts.circleRadius,
        });
        if (isOpen) {
            setAttributes(circle, {
                // don't show circle around open notes
                'stroke': 'none',
            })
        }
        note.appendChild(circle);

        // compute name of note
        const text = createSvgElement('text', {
            'data-note': noteName,
        });
        text.innerHTML = noteName;

        note.appendChild(text);

        const update = (noteId in this.data) ? this.data[noteId] : { type: 'note', color: 'white', visibility: this.state.visibility };
        this.updateNote(note, update);
    }

    computeNoteName(fret, string) {
        const interval = this.consts.stringIntervals[string] + fret + 1;
        return this.consts.notes[this.state.enharmonic][interval % 12];
    }

    drawNotes() {
        this.notes = createSvgElement('g', {
            'class': 'notes',
        })
        this.svg.appendChild(this.notes);

        // open notes (fret: -1)
        for (let j = 0; j < this.consts.numStrings; j++) {
            const noteId = `o-s${j}`;
            const x = this.consts.offsetX / 2;
            const y = this.consts.offsetY + this.consts.stringSpacing * j;
            const noteName = this.computeNoteName(-1, j);
            this.drawNote(noteId, x, y, noteName, true);
        }
        // notes on fretboard
        for (let i = this.state.startFret; i < this.state.endFret; i++) {
            for (let j = 0; j < this.consts.numStrings; j++) {
                const noteId = `f${i}-s${j}`;
                const x = this.consts.offsetX + (this.consts.fretWidth / 2) + this.consts.fretWidth * (i - this.state.startFret);
                const y = this.consts.offsetY + this.consts.stringSpacing * j;
                const noteName = this.computeNoteName(i, j);
                this.drawNote(noteId, x, y, noteName, false);
            }
        }
    }

    noteClickHandler(event) {
        event.stopPropagation();
        const note = event.currentTarget;
        note.focus();
        if (this.state.selected) {
            this.updateNote(this.state.selected, {
                visibility: 'visible',
            });
        }
        this.updateNote(note, {
            visibility: 'selected',
        });
        this.state.selected = note;

        if (event.ctrlKey) {
            this.editSelectedLabel();
        }
    }

    noteDoubleClickHandler(event) {
        event.stopPropagation();
        const note = event.currentTarget;
        if (this.state.selected) {
            this.updateNote(this.state.selected, {
                visibility: 'visible',
            });
        }
        this.updateNote(note, {
            visibility: 'selected',
        });
        this.state.selected = note;
        this.editSelectedLabel();
    }

    editSelectedLabel() {
        const selected = this.state.selected;
        const x = selected.getAttribute('data-x');
        const y = selected.getAttribute('data-y');
        setAttributes(this.editableText, {
            x: x - this.consts.circleRadius,
            y: y - this.consts.circleRadius + 4,
            height: 2 * this.consts.circleRadius,
            width: 2 * this.consts.circleRadius,
            class: 'visible',
            styles: {
                display: 'block',
            }
        });

        const selectedText = this.state.selected.lastChild;
        setAttributes(selectedText, {
            styles: {
                display: 'none',
            }
        });

        this.editableText.children[0].innerHTML = selectedText.innerHTML;
        this.editableText.children[0].focus();
        // select all text in editable div
        document.execCommand('selectAll', false, null);
    }

    addEditableDiv() {
        this.editableText = createSvgElement('foreignObject', {
            class: 'hidden',
        });
        this.editableText.addEventListener('click', (event) => {
            event.stopPropagation();
        });
        const div = document.createElement('div');
        div.setAttribute('contentEditable', 'true');
        div.setAttribute('id', 'editable-div')
        div.addEventListener('keydown', (event) => {
            event.stopPropagation();
            if (event.code === 'Enter') {
                event.target.blur();
            }
        });
        div.addEventListener('blur', (event) => {
            if (!this.state.selected) {
                return;
            }
            const selectedText = this.state.selected.lastChild;

            var newText = this.editableText.children[0].innerText;
            // don't allow empty labels
            if (newText.trim()) {
                this.updateNote(this.state.selected, {
                    noteText: newText,
                });
            }

            this.editableText.children[0].innerHTML = '';
            setAttributes(selectedText, {
                styles: {
                    display: 'block',
                }
            });
            setAttributes(this.editableText, {
                styles: {
                    display: 'none',
                }
            });
        })
        this.editableText.appendChild(div);
        this.svg.appendChild(this.editableText);
    }

    updateNote(elem, update) {
        if (!(elem.id in this.data)) {
            this.data[elem.id] = {};
        }
        const classValue = generateClassValue(elem, update);
        elem.setAttribute('class', classValue);

        if ('noteText' in update) {
            elem.lastChild.innerHTML = update.noteText;
        }

        const noteData = this.data[elem.id];
        for (let [key, value] of Object.entries(update)) {
            noteData[key] = value;
        }
    }

    toggleVisibility() {
        this.state.visibility = this.state.visibility === 'hidden' ? 'transparent' : 'hidden';
        for (let note of this.notes.children) {
            if (note.className.baseVal.endsWith('visible') || note.className.baseVal.endsWith('selected')) {
                continue;
            }
            this.updateNote(note, {
                visibility: this.state.visibility,
            })
        }

        for (let [_key, value] of Object.entries(this.data)) {
            if (value['visibility'] === 'visible' || value['visibility'] === 'selected') {
                continue;
            }
            value['visibility'] = this.state.visibility;
        }
    }

    clearSelection() {
        if (this.state.selected) {
            this.updateNote(this.state.selected, {
                visibility: 'visible',
            });
            this.state.selected = null;
        }
    }

    erase() {
        this.clearSelection();
        this.svg.innerHTML = "";
    }

    reset() {
        this.data = {};
        for (let note of this.notes.children) {
            // reset text
            const text = note.lastChild;
            if (text) {
                text.innerHTML = text.getAttribute('data-note');
            }
            this.updateNote(note,
                { type: "note", color: "white", visibility: this.state.visibility });
            this.state.selected = null;
        }
    }
}

/* Main */

/* Initialize diagram */

const svg = document.getElementById('fretboard');
const endFret = document.getElementById('end-fret');

const fretboard = new Fretboard({
    svg: svg,
    endFret: endFret
})

/* Button for toggeling unselected notes */

const togglebutton = document.getElementById('visibility');
togglebutton.addEventListener('click', (event) => {
    fretboard.toggleVisibility();
});

/* Save SVG button */

var svgButton = document.getElementById('save-svg');
const svgLink = document.getElementById('svg-link');

svgButton.addEventListener('click', () => {
    fretboard.clearSelection();
    const svgCopy = inlineCSS(svg);
    var svgData = svgCopy.outerHTML;
    var svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    var svgUrl = URL.createObjectURL(svgBlob);
    svgLink.href = svgUrl;
    svgLink.click();
});

const PROPERTIES = ["fill", "stroke", "stroke-width", "text-anchor", "dominant-baseline"]

function inlineCSS(svg) {
    const svgElements = document.querySelectorAll("#fretboard *");
    const clonedSVG = svg.cloneNode(deep = true);
    const clonedElements = clonedSVG.querySelectorAll("*");
    for (let i = 0; i < svgElements.length; i++) {
        const computedStyle = getComputedStyle(svgElements[i]);
        // remove invisible elements to reduce file size
        const opacity = computedStyle.getPropertyValue('opacity');
        if (opacity === '0') {
            clonedElements[i].remove();
            continue;
        }
        const styles = { opacity: opacity }
        for (let attr of PROPERTIES) {
            let value = computedStyle.getPropertyValue(attr);
            if (value) {
                styles[attr] = value;
            }
        }
        setAttributes(clonedElements[i], {
            'styles': styles,
        });
    }
    return clonedSVG;
}

/* Reset button */

const resetButton = document.getElementById('reset');
resetButton.addEventListener('click', (event) => {
    const doReset = window.confirm("Do you really want to reset your diagram?");
    if (doReset) {
        fretboard.reset();
    }
});

/* Fret window */

const startFret = document.getElementById('start-fret');
startFret.addEventListener('input', (event) => {
    fretboard.setFretWindow({ start: event.target.value - 1 });
});

endFret.addEventListener('input', (event) => {
    fretboard.setFretWindow({ end: parseInt(event.target.value) });
});

/* Color selector */

const colorButtons = document.querySelectorAll("button.color");
for (let button of colorButtons) {
    button.addEventListener('click', (event) => {
        fretboard.updateColor(event);
    });
}

const deleteNoteButton = document.getElementById("delete-note");
deleteNoteButton.addEventListener('click', () => fretboard.deleteNote());


const enharmonicToggle = document.getElementById("enharmonic");
enharmonicToggle.addEventListener('click', () => {
    const sign = fretboard.toggleEnharmonic();
    enharmonicToggle.innerHTML = sign;
});