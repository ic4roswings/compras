import { SafeUrl } from "@angular/platform-browser";

export class SolicitudFile {
    id: number;
    typeFile: string;
    description: string;
    status: string;
    creation: string;
    userMod: string;
    urlBlob?: SafeUrl;
    urlText?: string;
    icon?: SafeUrl | string;
}

export class FileUpload {
    key: string;
    name: string;
    url: string;
    file: File;
    isLoading: boolean;
    progress: number;

    constructor(file: File) {
        this.file = file;
        this.name = file.name;
        this.isLoading = false;
        this.progress = 0;
    }
}