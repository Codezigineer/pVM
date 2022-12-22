export function addPath(p1: string, p2: string): string
{
    if(p1.endsWith("/") && !(p2.startsWith("/")))
        return p1 + p2;

    if(p1.endsWith("/") && p2.startsWith("/"))
        return p1 + p2.slice(1);

    if(!(p1.endsWith("/")) && (p2.startsWith("/")))
        return p1 + p2;
    
    if(!(p1.endsWith("/")) && !(p2.startsWith("/")))
        return p1 + "/" + p2;

    throw new Error("Invalid path");
};

export const bytelen = (str: string) => { return new Blob([str]).size };