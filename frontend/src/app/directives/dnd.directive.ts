import { Directive, EventEmitter, ElementRef, HostBinding, HostListener, Input, Output } from '@angular/core';
import { FileUpload } from '../models/file.model';

@Directive({
  selector: '[appDnd]',
  standalone: true
})
export class DndDirective {

  // @HostBinding('class.file-over') fileOver: boolean;
  @Input() files: any[] = [];
  @Input() NumFilesAllowed: number;
  @Input() SizeAllowedFileBytes: number;
  @Output() errores = new EventEmitter<any>();
  @Output() mouseFileOver: EventEmitter<boolean> = new EventEmitter();
  @Output() exceedMaxFiles: EventEmitter<boolean> = new EventEmitter(false);
  @Output() fileDropped = new EventEmitter<any>();
  erroreslist: string[] = [];
  constructor() { }

  @HostListener('dragover', ['$event']) onDragOver(evt) {
    this.mouseFileOver.emit(true);
    this._preventStop(evt);
    // this.fileOver = true;
    //console.log('Drag Over');
  }

  @HostListener('dragleave', ['$event']) onDragLeave(evt) {
    this.mouseFileOver.emit(false);
    this._preventStop(evt);
    // this.fileOver = false;
    //console.log('Drag Leave');
  }

  @HostListener('drop', ['$event']) public ondrop(evt) {
    // this.fileOver = false;
    this.erroreslist = [];
    const tranferencia = this._getTransfer(evt);
    if (!tranferencia) {
      return;
    }
    this._extractFiles(tranferencia.files);
    this.fileDropped.emit(this.files);
    // const files = evt.dataTransfer.files;
    // if (files.length > 0) {
    //   this.fileDropped.emit(files);
    //   console.log(`You dropped ${files.length} files`);
    // }
    this.errores.emit(this.erroreslist);
    //console.log(this.errores);
    this._preventStop(evt);
    this.mouseFileOver.emit(false);
    //console.log('Drag Drop files', this.files);
  }

  private _getTransfer(event: any) {
    return event.dataTransfer ? event.dataTransfer : event.originalEvent.dataTransfer;
  }

  private _extractFiles(fileList: FileList) {
    if (!this._maxFiles(fileList)) {
      Array.from(fileList).forEach(file => {
        //console.log(file);
        if (this._fileCanLoaded(file)) {
          this.files.push(file);
        }
      });
    }
  }

  public _maxFiles(fileList: FileList) {
    const filesLoaded = this.files.length;
    const filesNew = fileList.length;
    const filesTotal = filesLoaded + filesNew;
    //console.log(filesTotal);
    if (filesTotal <= this.NumFilesAllowed) {
      this.exceedMaxFiles.emit(false);
      return false;
    }
    else {
      this.exceedMaxFiles.emit(true);
      return true;
    }
  }

  // Validaciones
  private _fileCanLoaded(file: File) {
    if (!this._fileDrop(file.name) && this.isFileTypeValid(file.type) && this._fileSizeLimit(file)) {
      return true;
    }
    else {
      return false;
    }
  }

  private _preventStop(event) {
    event.preventDefault();
    event.stopPropagation();
  }

  private _fileDrop(filename: string): boolean {
    for (const file of this.files) {
      if (file.name === filename) {
        this.erroreslist.push('El archivo ' + filename + ' ya fue agregado.');
        return true;
      }
    }
    return false;
  }

  private isFileTypeValid(fileType: string) {
    return (fileType === '' || fileType === undefined) ? false : (fileType.startsWith('image') || fileType.startsWith('text'));
  }

  private _fileSizeLimit(file: File) {
    if (this.SizeAllowedFileBytes < file.size) {
      this.erroreslist.push(`El archivo ${file.name} excede el tamaño permitido.`);
      return false;
    }
    else {
      return true;
    }
  }

}
