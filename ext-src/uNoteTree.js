"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

const vscode = require("vscode");
const path = require("path");
const { Config, Utils } = require("./uNotesCommon");

class UNoteTree {

    constructor(name, isOrdered) {
        if (isOrdered === undefined)
            isOrdered = true;
        this.name = name;
        this.isOrdered = isOrdered;
        this.folders = {};
        this.files = {};
    }

    // recursively find the folder from paths
    getFolder(paths) {
        if (paths.length == 0) {
            return this;
        }
        const folderName = paths.shift();
        let child = this.folders[folderName];
        if (!child) {
            child = new UNoteTree(folderName);
            this.folders[folderName] = child;
        }
        return child.getFolder(paths);
    }

    syncFolders(folders) {
        const count = folders.length;
        for (let i = 0; i < count; ++i) {
            const folder = this.getFolder([folders[i].label]);
            folders[i].addState(folder.isOrdered ? 'ord' : 'uord');
            if (!folder.isOrdered) {
                folders[i].setUnorderedIcon();
            }
        }
        // remove folders that don't exist
        this.removeMissing(folders, this.folders);
    }

    removeMissing(notes, obj) {
        try {
            let count = notes.length;
            const seen = new Set();
            for (let i = 0; i < count; ++i) {
                seen.add(notes[i].label);
            }
            const toRemove = [];
            for (let key in obj) {
                if (obj.hasOwnProperty(key)) {
                    if (!seen.has(key)) {
                        toRemove.push(key);
                    }
                }
            }
            count = toRemove.length;
            for (let i = 0; i < count; i++) {
                delete obj[toRemove[i]];
            }

        } catch (e) {
            const msg = e.message;
            console.log(msg);
        }
    }

    renameNote(oldName, newName){
        const index = this.files[oldName];
        if(index === undefined){
            return false;
        }
        this.files[newName] = index;
        return true;
    }

    renameFolder(oldName, newName){
        const folder = this.folders[oldName];
        if(folder === undefined){
            return false;
        }
        folder.name = newName;
        delete this.folders[oldName];
        this.folders[newName] = folder;
        return true;
    }

    syncFiles(notes) {
        // set is ordered state
        const count = notes.length;
        for (let i = 0; i < count; i++) {
            notes[i].addState(this.isOrdered ? 'ord' : 'uord');
        }


        if (!this.isOrdered) return;

        // sync with files
        let nextIndex = 1000000;
        // sort the notes array
        notes.sort((a, b) => {
            let ai = this.files[a.label];
            if (ai == undefined) {
                ai = nextIndex++;
                this.files[a.label] = ai
            }
            let bi = this.files[b.label];
            if (bi == undefined) {
                bi = nextIndex++;
                this.files[b.label] = bi;
            }
            return ai - bi;
        });

        // remove notes that don't exist
        this.removeMissing(notes, this.files);

        // reset the files indexes
        for (let i = 0; i < count; i++) {
            this.files[notes[i].label] = i;
        }
    }

    moveUp(key) {
        let value = this.files[key];
        if (value != undefined) {
            value = Math.max(0, --value);
            this.files[key] = value;
            for (let k in this.files) {
                if (this.files.hasOwnProperty(k) && k !== key) {
                    if (this.files[k] == value)
                        this.files[k] = value + 1;
                }
            }
        }
    }

    moveDown(key) {
        let value = this.files[key];
        if (value !== undefined) {
            value = Math.min(Object.keys(this.files).length - 1, ++value);
            this.files[key] = value;
            for (let k in this.files) {
                if (this.files.hasOwnProperty(k) && k !== key) {
                    if (this.files[k] == value)
                        this.files[k] = value - 1;
                }
            }
        }
    }

    getTreeFilePath() {
        return path.join(Config.folderPath, 'unotes_meta.json');
    }

    loadFromObject(obj) {
        this.name = obj.name;
        if (obj.isOrdered === undefined)
            obj.isOrdered = true;
        this.isOrdered = obj.isOrdered;
        this.files = obj.files;
        for (let key in obj.folders) {
            const tree = new UNoteTree();
            tree.loadFromObject(obj.folders[key]);
            this.folders[key] = tree;
        }
    }

    async load() {
        try {
            const fp = this.getTreeFilePath();
            if (await Utils.fileExists(fp)) {
                const decoder = new TextDecoder();
                const data = decoder.decode(await vscode.workspace.fs.readFile(vscode.Uri.file(fp)));
                const obj = JSON.parse(data);
                this.loadFromObject(obj);
            }
        } catch (e) {
            const msg = e.message;
            console.log(msg);
            await vscode.window.showWarningMessage("Failed to load Unotes meta information. \nNote ordering may be lost.");
        }
    }

    async save() {
        try {
            const encoder = new TextEncoder();
            await vscode.workspace.fs.writeFile(vscode.Uri.file(this.getTreeFilePath()), encoder.encode(JSON.stringify(this, null, 2)));
        } catch (e) {
            const msg = e.message;
            console.log(msg);
        }
    }
}

exports.UNoteTree = UNoteTree;
