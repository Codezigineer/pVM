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
    S_IFMT,
    S_IFLNK,
    O_CREAT,
    O_DIRECTORY
} from "./defs";
import { addPath, bytelen } from "./utils";
import { FileSystem, inode } from "./inode";

export type FileDescOptions = 
{
    seekPos: number;
};

export class SyscallsList 
{
    private fs: FileSystem;
    cwd: string = "/";
    pid: number = 0;
    openFds: inode[] = [];
    fdOptions: FileDescOptions[] = [];
    user: number = 0;
    group: number = 0;
    wasmMem: Uint8ClampedArray = new Uint8ClampedArray(0);
    stackBottom: number = 64; // * PAGESIZE
    memMappings: {start: number, len: number, prot: number, flags: number, fd: number, off: number}[] = [];

    constructor(fs: FileSystem) 
    {
        this.fs = fs;
    };

    private _open(path: string): number 
    {
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

        return this.openFds.push(curNode);
    };

    open(pathPtr: number, flags: number, mode: number): number 
    {
        let path = this.getStrAtPtr(pathPtr);
        let openF = this._open(path);
        if((flags & O_CREAT) == O_CREAT && openF == 0)
            return -EEXIST;
        
        if(this.openFds[openF].directory && (!((flags & O_DIRECTORY) == O_DIRECTORY)))
            return -EISDIR;
        else if((!this.openFds[openF].directory) && ((flags & O_DIRECTORY) == O_DIRECTORY))
            return -ENOTDIR;

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
            
            let name = "err";
            if(dir.endsWith("/")) name = nodes[nodes.length-2];
            else name = nodes[nodes.length-1];

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
            (curNode.childrenFiles as Map<string, number>)[name] = file;

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
    
    _pgAlign(size: number): number
    {
        return (number >> 16) << 16;
    };

    creat(path: number, mode: number): number
    {
        return this.open(path, O_WRONLY | O_EXCL | O_CREAT, mode);
    };
    
    brk(point: number): number
    {
        if(this._pgAlign(point) < PAGESIZE * 16) return -ENOMEM;
        this.stackBottom = point / PAGESIZE;
        return 0;
    };
    
    private _doStat(node: inode, buf: number)
    {
        let dataView = new DataView(this.wasmMem.buffer, buf);
        let offset = buf;
        dataView.setUint32(offset, node.stat.dev);
        offset += 4;
        //stat32
      //if(WSZ === 64) { dataView.setBigUint64(offset, BigInt(node.stat.ino)); offset += 8 }
      /*else {*/ dataView.setUint32(buf + 4, BigInt(node.stat.ino)); offset += 4/*}*/;
        dataView.setUint32(offset, node.stat.mode);
        offset += 4;
        dataView.setUint16(offset, node.stat.nlink);
        offset += 2;
        dataView.setUint32(offset, node.stat.uid);
        offset += 4;
        dataView.setUint32(offset, node.stat.gid);
        offset += 4;
        dataView.setUint32(offset, node.stat.rdev);
        offset += 4;
        dataView.setUint32(offset, node.stat.size);
        offset += 4;
        dataView.setUint16(offset, node.stat.blksize);
        offset += 2;
        dataView.setUint32(offset, node.stat.blkcnt);
        offset += 4;
        dataView.setUint32(offset, node.stat.atime.getTime());
        offset += 4;
        dataView.setUint32(offset, node.stat.ctime.getTime());
        offset += 4;
        dataView.setUint32(offset, node.stat.mtime.getTime());
    };
    
    private _doStat64(node: inode, buf: number)
    {
        let dataView = new DataView(this.wasmMem.buffer, buf);
        let offset = buf;
        dataView.setUint32(offset, node.stat.dev);
        offset += 4;
        //stat64
        dataView.setBigUint64(offset, BigInt(node.stat.ino)); offset += 8;
      /*else { dataView.setUint32(buf + 4, BigInt(node.stat.ino)); offset += 4};*/
        dataView.setUint32(offset, node.stat.mode);
        offset += 4;
        dataView.setUint16(offset, node.stat.nlink);
        offset += 2;
        dataView.setUint32(offset, node.stat.uid);
        offset += 4;
        dataView.setUint32(offset, node.stat.gid);
        offset += 4;
        dataView.setUint32(offset, node.stat.rdev);
        offset += 4;
        dataView.setBigUint64(offset, BigInt(node.stat.size));
        offset += 8;
        dataView.setUint16(offset, node.stat.blksize);
        offset += 2;
        dataView.setUint32(offset, node.stat.blkcnt);
        offset += 4;
        dataView.setUint32(offset, node.stat.atime.getTime());
        offset += 4;
        dataView.setUint32(offset, node.stat.ctime.getTime());
        offset += 4;
        dataView.setUint32(offset, node.stat.mtime.getTime());
    };
    
    fstat(fd: number, buf: number): number
    {
         return this._doStat(this.openFds[fd], buf);
    };
    
    lstat(path: number, buf: number): number
    {
        let file = this._open(this.getStrFromPtr(path));
        
        let o = this._doStat(this.openFds[file], buf);
        this.close(file);
        return o;
    };
    
    stat(path: number, buf: number): number
    {
        let file = this._open(this.getStrFromPtr(path));
        if((this.openFds[file].stat.mode & S_IFMT) == S_IFLNK)
        {
            let file2 = this._open(this.getStrFromPtr(new TextDecoder().decode(new Uint8Array(file.data))));
        
            let o2 = this._doStat(this.openFds[file2], buf);
            this.close(file);
            this.close(file2);
            return o2;
        };
        let o = this._doStat(this.openFds[file], buf);
        this.close(file);
        return o;
    };
    
    _setMemWriteHook(func: (number) => void): number
    {
        // no-op
    };
    
    _setMemReadHook(func: (number) => void): number
    {
        // no-op
    };
    
    mmap(start: number, len: number, prot: number, flags: number, fd: number, off: number): number
    {
        let realStart = this._pgAlign(start);
        let realLen = this._pgAlign(len);
        // Make sure there are no overlapping mappings
        for(const mapping of this.memoryMappings)
            if(realStart === mapping.start ||
               fd === mapping.fd ||
               (realStart + len) > mapping.start) return -EINVAL;
        this.memoryMappings.push({
            start: realStart,
            len: realLen,
            prot: prot,
            flags: flags,
            fd: fd,
            off: off
        });
    };
    
    getdents(fd: number, dirp: number, count: number): number
    {
        let offset = dirp;
        if(!(fd in this.openFds)) return -EBADF;
        if(!this.openFds[fd].directory) return -ENOTDIR;
        let dv = new DataView(this.wasmMem.buffer);
        for(const [name, ino] of Object.entries(this.openFds[fd].children))
        {
            if((buf - offset) > (count + bytelen(file.name) + offset + 8)) return 0;
            let file = this.fs.inodes[ino];
            dv.setUint32(offset, file.stat.ino);
            offset += 4;
            dv.setUint32(offset, bytelen(file.name) + offset + 8);
            offset += 4;
            dv.setUint16(offset, dirp - (bytelen(file.name) + offset + 8));
            offset += 2;
            this.writeStrToPtr(file.name, offset);
            offset += bytelen(file.name) + 1;
            dv.setUint8(offset, file.stat.mode);
            offset += 1;
        };
        return 0;
    };
};
