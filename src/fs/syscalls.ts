import {
    EACCES,
    EBADF,
    EEXIST,
    EINVAL,
    EISDIR,
    ENAME2BIG,
    ENOENT,
    ENOTDIR,
    O_CREAT
} from "./defs";
import { addPath, bytelen } from "./utils";
import { FileSystem, inode } from "./inode";

export type FileDescOptions = {
    seekPos: number;
};

export class SyscallsList {
    private fs: FileSystem;
    cwd: string;
    openFds: inode[];
    fdOptions: FileDescOptions[];
    user: number;
    group: number;
    wasmMem: Uint8ClampedArray;

    constructor(fs: FileSystem) {
        this.fs = fs;
    };

    private _open(path: string): number {
        if (bytelen(path) > 128)
            return -ENAME2BIG;

        const invalidpathchars = [
            ...Array.from((new Array(31)).keys())
                .map((_, idx) => {
                    return String.fromCharCode(idx);
                }),
            ...Array.from((new Array(127)).keys())
                .map((_, idx) => {
                    return String.fromCharCode(idx + 128);
                }),
        ];

        for (let i of path.split("")) {
            if (i in invalidpathchars) {
                return -EINVAL;
            };
        };

        let rpath = "";
        if (path.startsWith(".") || !path.startsWith("/"))
            rpath = addPath(this.cwd, path);

        /*
        if(path.startsWith("~") || !path.startsWith("/"))
            rpath = addPath(this., path); The kernel doesn't know the home dir
        */
        if (!rpath)
            return -EINVAL;

        let nodes = rpath.split("/");
        let curNode = this.fs.childrenFiles[nodes[0]];
        for (let i = 1; i != nodes.length; i += 1) {
            if (!curNode.directory && !curNode.blkDevice)
                return -ENOTDIR;
            try {
                curNode = curNode.childrenFiles[nodes[i]];
            } catch {
                return -ENOENT;
            };
        };

        this.openFds.push(curNode);

        return this.openFds.length;
    };

    open(path: string, flags: number, mode: number): number 
    {
        let openF = this._open(path);
        if((flags & O_CREAT) == O_CREAT && openF == 0)
        {
            this.close(openF);
            return -EEXIST;
        };

        if((flags & O_CREAT) == O_CREAT)
        {
            this.close(openF);
            let dir = path + "";
            dir = dir.slice(0, dir.length - ("/" + path.split("/")[path.split("/").length-1]).length);
            openF = this._open(dir);
            if(openF == -ENOENT)
                return -ENOENT;
            let nodes = dir.split("/");
            let curNode: inode = this.fs.childrenFiles[nodes[0]];
            for (let i = 1; i != nodes.length; i += 1) {
                if (!curNode.directory && !curNode.blkDevice)
                    return -ENOTDIR;
                try {
                    curNode = (curNode.childrenFiles as Map<string, number>)[nodes[i]];
                } catch {
                    return -ENOENT;
                };
            };

            let file = this.fs.inodes.push(new inode());
            this.fs.inodes[file].stat.ino = file;
            this.fs.inodes[file].stat.birthtime = new Date();
            this.fs.inodes[file].stat.atime = this.fs.inodes[file].stat.birthtime;
            this.fs.inodes[file].stat.mtime = this.fs.inodes[file].stat.birthtime;
            this.fs.inodes[file].stat.ctime = this.fs.inodes[file].stat.birthtime;


            curNode[path.replace(dir, "")]
            (curNode[path.replace(dir, "")] as inode).stat.uid = this.user;
            (curNode[path.replace(dir, "")] as inode).stat.gid = this.group;
        } else {
            this.close(openF);
        };

        let fd = this._open(path);

        if(this.openFds[fd].stat.uid !== this.user || this.openFds[fd].stat.gid !== this.group)
            return -EACCES;
        
        return fd;
    };

    close(fd: number): number
    {
        try {
            delete this.openFds[fd];
        } catch {
            return -EBADF;
        }

        return 0;
    };

    private getStrAtPtr(ptr: number): string
    {
        if(ptr < 0 || ptr % 1 !== 0 )
            return "";
        
        let str: string[] = [];

        for(let i = ptr; this.wasmMem[i] !== 0 || i === 2**24; i++)
            str.push(String.fromCharCode(this.wasmMem[i]));
        
        return str.join();
    };

    write(fd: number, ptr: number): number 
    {
        if(!(fd in Array.from(this.openFds.keys())))
            return -EBADF;
        
        if(ptr < 0 || ptr % 1 !== 0 )
            return -EINVAL;
        
        if(this.openFds[fd].directory)
            return -EISDIR;
        
        let writeData = this.getStrAtPtr(ptr);
        
        let text = new Uint8Array(((this.openFds[fd].data as ArrayBuffer).byteLength) + writeData.length);
        text.set(new Uint8Array((this.openFds[fd].data as ArrayBuffer)), 0);
        text.set((new TextEncoder().encode(writeData)), new Uint8Array((this.openFds[fd].data as ArrayBuffer)).byteLength);
        this.openFds[fd].data = text.buffer;
        
        return -EINVAL;
    };
};
