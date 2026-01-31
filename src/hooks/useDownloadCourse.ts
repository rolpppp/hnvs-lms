import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { db } from '../lib/db';

export function useDownloadCourse() {
    const [downloading, setDownloading] = useState(false);
    const [progress, setProgress] = useState(0); // 0 to 100
    const [status, setStatus] = useState<string>('');

    const downloadCourse = async (courseId: string) => {
        if (!navigator.onLine) {
            alert("You need to be online to download course content.");
            return;
        }

        try {
            setDownloading(true);
            setProgress(0);
            setStatus('Preparing download...');

            // 1. Get lessons from local DB (already synced)
            const lessons = await db.lessons.where({ courseId }).toArray();
            const downloadableLessons = lessons.filter(l => l.storage_path && (l.type === 'video' || l.type === 'pdf'));

            if (downloadableLessons.length === 0) {
                setStatus('No assets to download.');
                await db.courses.update(courseId, { isDownloaded: true });
                setProgress(100);
                setTimeout(() => setDownloading(false), 1000);
                return;
            }

            let completed = 0;
            const total = downloadableLessons.length;

            for (const lesson of downloadableLessons) {
                if (!lesson.storage_path) continue;

                setStatus(`Downloading: ${lesson.title}`);

                // Check if already downloaded
                const existing = await db.materials.get(lesson.id);
                if (existing) {
                    completed++;
                    setProgress(Math.round((completed / total) * 100));
                    continue;
                }

                try {
                    // Download Blob
                    const { data: blob, error } = await supabase.storage
                        .from('course-content')
                        .download(lesson.storage_path);

                    if (error) throw error;
                    if (blob) {
                        // Save to IndexedDB
                        // We use lesson.id as the material id for 1:1 mapping
                        await db.materials.put({
                            id: lesson.id,
                            courseId: courseId,
                            title: lesson.title,
                            type: lesson.type as 'pdf' | 'video' | 'text',
                            content: blob,
                        });
                    }
                } catch (err) {
                    console.error(`Failed to download lesson ${lesson.title}`, err);
                    // Continue to next lesson even if one fails? 
                    // ideally yes, but let's log it.
                }

                completed++;
                setProgress(Math.round((completed / total) * 100));
            }

            // Mark course as downloaded
            await db.courses.update(courseId, { isDownloaded: true });
            setStatus('Download Complete');

        } catch (error: any) {
            console.error('Download failed:', error);
            setStatus('Download failed: ' + error.message);
        } finally {
            setDownloading(false);
        }
    };

    return { downloadCourse, downloading, progress, status };
}
