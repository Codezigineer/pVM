import {
    EACCES,
    EBADF,
    EEXIST,
    EFAULT,
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
    pid: number;
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

    open(pathPtr: number, flags: number, mode: number): number 
    {
        let path = this.getStrAtPtr(pathPtr);
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
            if(path.startsWith("."))
            {
                path = path.slice(1, 0);
                path = addPath(this.cwd, path);
            };
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

            let file                            = this.fs.inodes.push(new inode());
            this.fs.inodes[file].stat.ino       = file;
            this.fs.inodes[file].stat.birthtime = new Date();
            this.fs.inodes[file].stat.atime     = this.fs.inodes[file].stat.birthtime;
            this.fs.inodes[file].stat.mtime     = this.fs.inodes[file].stat.birthtime;
            this.fs.inodes[file].stat.ctime     = this.fs.inodes[file].stat.birthtime;
            this.fs.inodes[file].stat.mode      = mode;
            this.fs.inodes[file].stat.size      = 0;
            this.fs.inodes[file].stat.rdev      = this.fs.stat.rdev;
            this.fs.inodes[file].stat.dev       = this.fs.stat.dev;
            this.fs.inodes[file].stat.blocks    = 0;
            this.fs.inodes[file].stat.uid       = this.user;
            this.fs.inodes[file].stat.gid       = this.group;

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

        for(let i = ptr; i > this.wasmMem.byteLength || this.wasmMem[i] !== 0 || i === 2**24; i++)
        {
            if(i > this.wasmMem.byteLength)
                return "";
            str.push(String.fromCharCode(this.wasmMem[i]));
        }
        
        return str.join();
    };

    write(fd: number, ptr: number): number 
    {
        if(!(fd in Array.from(this.openFds.keys())))
            return -EBADF;
        
        if(ptr < 0 || ptr % 1 !== 0 )
            return -EFAULT;
        
        if(this.openFds[fd].directory)
            return -EISDIR;
        
        let writeData = this.getStrAtPtr(ptr);
        
        let text = new Uint8Array(((this.openFds[fd].data as ArrayBuffer).byteLength) + writeData.length);
        text.set(new Uint8Array((this.openFds[fd].data as ArrayBuffer)), 0);
        text.set((new TextEncoder().encode(writeData)), new Uint8Array((this.openFds[fd].data as ArrayBuffer)).byteLength);
        this.openFds[fd].data           = text.buffer;
        this.openFds[fd].stat.atime     = new Date();
        this.openFds[fd].stat.mtime     = new Date();
        return 0;
    };

    private writeStrToPtr(str: string, ptr: number)
    {
        let txt: Uint8Array = new TextEncoder().encode(str);
        for(let idx = 0; idx > this.wasmMem.byteLength || this.wasmMem[idx] !== 0 || idx === 2**24 || idx > txt.length; idx+=1)
            this.wasmMem[ptr+idx] = txt[idx];
    };

    read(fd: number, buf: number, size: number): number
    {
        if(!(fd in Array.from(this.openFds.keys())))
            return -EBADF;
    
        if(buf < 0 || buf % 1 !== 0 )
            return -EFAULT;
        
        if(size < 0 || size % 1 !== 0 )
            return -EINVAL;
    
        if(this.openFds[fd].directory)
            return -EISDIR;
        
        if((this.wasmMem.length - buf) > size)
            return -EFAULT;
                
        this.writeStrToPtr(new TextDecoder().decode(new Uint8Array(this.openFds[fd].data as ArrayBuffer)), buf);

        return 0;
    };

    creat()
};
