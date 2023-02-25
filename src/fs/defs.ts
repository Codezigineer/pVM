export const INODEFLAGS = 
{
    r    : 0,
    'r+' : 2,
    'rs' : 0 | 0o40000 | 0o4010000,
    'rs+': 2 | 0o40000 | 0o4010000,
    'w'  : 1 | 0o100 | 0o2000,
    'wx' : 1 | 0o100 | 0o2000 | 0o200,
    'w+' : 2 | 0o100 | 0o2000,
    'wx+': 2 | 0o100 | 0o2000 | 0o200,
    'a'  : 1 | 0o2000 | 0o100,
    'ax' : 1 | 0o2000 | 0o100 | 0o200,
    'a+' : 2 | 0o2000 | 0o100,
    'ax+': 2 | 0o2000 | 0o100 | 0o200,
};

export const PAGESIZE = 65536;

export class stat
{
    dev: number = 0;
    ino: number = 0;
    mode: number = 0;
    nlink: number = 0;
    uid: number = 0;
    gid: number = 0;
    rdev: number = 0;
    size: number = 0;
    get blksize(): number
    {
        return 4096;
    };
    blocks: number = 0;
    atime: Date = new Date();
    mtime: Date = new Date();
    ctime: Date = new Date();
    birthtime: Date = new Date();
};

export const S_IFMT    = 0o170000,
             S_IFSOCK  = 0o140000,
             S_IFLNK   = 0o120000,
             S_IFREG   = 0o100000,
             S_IFBLK   = 0o060000,
             S_IFDIR   = 0o040000,
             S_IFCHR   = 0o020000,
             S_IFIFO   = 0o010000,
             S_ISUID   = 0o004000,
             S_ISGID   = 0o002000,
             S_ISVTX   = 0o001000,
             S_IRWXU   = 0o000700,
             S_IRUSR   = 0o000400,
             S_IWUSR   = 0o000200,
             S_IXUSR   = 0o000100,
             S_IRWXG   = 0o000070,
             S_IRGRP   = 0o000040,
             S_IWGRP   = 0o000020,
             S_IXGRP   = 0o000010,
             S_IRWXO   = 0o000007,
             S_IROTH   = 0o000004,
             S_IWOTH   = 0o000002,
             S_IXOTH   = 0o000001;
export const EPERM     =        1, /* Operation not permitted */
             ENOENT    =        2, /* No such file or directory */
             ESRCH     =        3, /* No such process */
             EINTR     =        4, /* Interrupted syscall */
             EIO       =        5, /* I/O error */
             ENXIO     =        6, /* No such device or address */
             E2BIG     =        7, /* Arg list too long */
             ENOEXEC   =        8, /* Exec format error */
             EBADF     =        9, /* Bad file number */
             ECHILD    =       10, /* No child processes */
             EAGAIN    =       11, /* Try again */
             ENOMEM    =       12, /* Out of memory */
             EACCES    =       13, /* Permission denied */
             EFAULT    =       14, /* Bad address */
             ENOTBLK   =       15, /* Block device required */
             EBUSY     =       16, /* Device or resource busy */
             EEXIST    =       17, /* File exists */
             EXDEV     =       18, /* Cross-device link */
             ENODEV    =       19, /* No such device */
             ENOTDIR   =       20, /* Not a directory */
             EISDIR    =       21, /* Is a directory */
             EINVAL    =       22, /* Invalid arguments */
             ENFILE    =       23, /* File table overflow */
             EMFILE    =       24, /* Too many open files */
             ENOTTY    =       25, /* Not a console */
             ETXTBUSY  =       26, /* Somehow a text file is busy */
             EFBIG     =       27, /* File too big */
             ENOSPC    =       28, /* No space left on FS */
             ESPIPE    =       29, /* Illegal seek */
             EROFS     =       30, /* Const FS */
             EMLINK    =       31, /* Where dos the link chain go? */
             EPIPE     =       32, /* The pipe is leaking! */
             ENAME2BIG =       33, /* Why is it this long? */
             ENOSYS    =       38, /* Damn */
             EUSERS    =       87;

export const O_RDONLY     = 0,
             O_WRONLY     = 1,
             O_RDWR       = 2,
             O_CREAT      = 64,
             O_EXCL       = 128,
             O_NOCTTY     = 256,
             O_TRUNC      = 512,
             O_APPEND     = 1024,
             O_NONBLOCK   = 2048,
             O_DIRECT     = 16384,
             O_DIRECTORY  = 65536,
             O_NOFOLLOW   = 131072,
             O_SYNC       = 1052672;
