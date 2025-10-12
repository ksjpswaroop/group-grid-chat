import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { FileText, Image, Table, FileType, File } from "lucide-react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Sanitizes a file URL to show only the filename instead of the full Supabase storage path
 */
export function sanitizeFileUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const filename = pathParts[pathParts.length - 1];
    // Decode URI component to show original filename
    return decodeURIComponent(filename);
  } catch {
    return 'file';
  }
}

/**
 * Returns the appropriate icon component for a given file type
 */
export function getFileIcon(fileType: string) {
  if (fileType.startsWith('image/')) return Image;
  if (fileType === 'application/pdf') return FileText;
  if (fileType.includes('word')) return FileType;
  if (fileType.includes('sheet') || fileType.includes('excel')) return Table;
  return File;
}

/**
 * Formats file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
