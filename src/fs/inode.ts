import 
{
    stat,
    S_IFBLK,
    S_IFCHR,
    S_IFDIR,
    S_IFIFO,
    S_IFLNK,
    S_IFMT,
    S_IFREG, 
    S_IFSOCK
} from "./defs";
import { SyscallsList } from "./syscalls";

export class inode
{
    private _stat: stat;
    private _name: string;
    data: ArrayBuffer | null;
    childrenFiles: (Map<string, number>) | null;

    public get stat(): stat 
    {
        return this._stat;
    }
    
    isType(mask: number)
    {
        return ((this.stat.mode & S_IFMT) == mask) as boolean;
    };

    get name(): string 
    {
        return this._name;
    };

    get directory(): boolean 
    {
        return this.isType(S_IFDIR) && !(this.isType(S_IFREG));
    };

    get file(): boolean 
    {
        return !this.directory;
    };

    get charDevice(): boolean 
    {
        return this.isType(S_IFCHR);
    };

    get blkDevice(): boolean
    {
        return this.isType(S_IFBLK);
    };

    get isFIFO(): boolean 
    {
        return this.isType(S_IFIFO);
    };

    get isHardlink(): boolean
    {
        return this.isType(S_IFLNK);
    };

    get isSocket(): boolean
    {
        return this.isType(S_IFSOCK);
    };
};

export class FileSystem extends inode
{
    syscalls: SyscallsList[];
    private _realStat: stat;
    data: ArrayBuffer | null;
    childrenFiles: Map<string, number>;
    inodes: inode[];

    override get stat(): stat
    {
        let sta                    = new stat();
        sta.atime                  = this._realStat.atime;
        sta.mtime                  = this._realStat.mtime;
        sta.ctime                  = this._realStat.ctime;
        sta.birthtime              = this._realStat.birthtime;
        sta.blksize                = this._realStat.blksize;
        sta.size                   = this._realStat.size;
        sta.mode                   = S_IFBLK;
        sta.uid                    = this._realStat.uid;
        sta.gid                    = this._realStat.gid;
        sta.dev                    = 0, 
        sta.ino                    = 0, 
        sta.rdev                   = 0;
        sta.blocks                 = Math.floor(this._realStat.size / 4096);
        sta.nlink                  = 0;
        return sta;
    };
};