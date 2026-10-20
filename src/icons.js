import {createElement, CircleCheck, Archive, ArrowRight, ArrowUpRight, Bold, Calendar, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, Circle, CircleHelp, CirclePlus, ClipboardPaste, Columns2, Copy, Delete, Diamond, Download, ExternalLink, Eye, File, FileInput, FileText, FileType, Files, FolderOpen, Fullscreen, Globe, Grip, HardDrive, Heading, Heart, Hexagon, Image, Italic, Layers, LayoutDashboard, Link, LoaderCircle, LockKeyhole, Maximize, Menu, MessageSquare, Minus, Monitor, MoveVertical, NotebookTabs, Pentagon, Plus, Presentation, Redo, Redo2, RotateCw, Section, Shapes, Sheet, Sidebar, Sparkles, Square, SquareCheck, Star, StickyNote, Table, Table2, Target, Text, Trash2, Triangle, Type, Underline, Undo, Undo2, Video, X, ZoomIn, ZoomOut} from "lucide";

// Import only the app's icon set so the remaining Lucide library is tree shaken.
const icons = {"circle-check":CircleCheck,"archive":Archive,"arrow-right":ArrowRight,"arrow-up-right":ArrowUpRight,"bold":Bold,"calendar":Calendar,"calendar-days":CalendarDays,"chevron-down":ChevronDown,"chevron-left":ChevronLeft,"chevron-right":ChevronRight,"chevrons-up-down":ChevronsUpDown,"circle":Circle,"circle-help":CircleHelp,"circle-plus":CirclePlus,"clipboard-paste":ClipboardPaste,"columns-2":Columns2,"copy":Copy,"delete":Delete,"diamond":Diamond,"download":Download,"external-link":ExternalLink,"eye":Eye,"file":File,"file-input":FileInput,"file-text":FileText,"file-type":FileType,"files":Files,"folder-open":FolderOpen,"fullscreen":Fullscreen,"globe":Globe,"grip":Grip,"hard-drive":HardDrive,"heading":Heading,"heart":Heart,"hexagon":Hexagon,"image":Image,"italic":Italic,"layers":Layers,"layout-dashboard":LayoutDashboard,"link":Link,"loader-circle":LoaderCircle,"lock-keyhole":LockKeyhole,"maximize":Maximize,"menu":Menu,"message-square":MessageSquare,"minus":Minus,"monitor":Monitor,"move-vertical":MoveVertical,"notebook-tabs":NotebookTabs,"pentagon":Pentagon,"plus":Plus,"presentation":Presentation,"redo":Redo,"redo-2":Redo2,"rotate-cw":RotateCw,"section":Section,"shapes":Shapes,"sheet":Sheet,"sidebar":Sidebar,"sparkles":Sparkles,"square":Square,"square-check":SquareCheck,"star":Star,"sticky-note":StickyNote,"table":Table,"table-2":Table2,"target":Target,"text":Text,"trash-2":Trash2,"triangle":Triangle,"type":Type,"underline":Underline,"undo":Undo,"undo-2":Undo2,"video":Video,"x":X,"zoom-in":ZoomIn,"zoom-out":ZoomOut};
const templates = new Map();
export function refreshIcons(root = document) {
  // Render new placeholders only; existing SVGs keep their DOM identity.
  for (const placeholder of root.querySelectorAll('i[data-lucide]')) {
    const name = placeholder.dataset.lucide;
    if (!icons[name]) throw new Error('Unknown icon: '+name);
    if (!templates.has(name)) {
      const [tag, attrs, children] = icons[name];
      templates.set(name, createElement([tag, {...attrs, 'stroke-width':1.7, class:'lucide lucide-'+name, 'aria-hidden':'true'}, children]));
    }
    const svg = templates.get(name).cloneNode(true);
    for (const cls of placeholder.classList) svg.classList.add(cls);
    placeholder.replaceWith(svg);
  }
}
