package com.passmanager.app;

import android.util.Base64;
import android.webkit.JavascriptInterface;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.Arrays;

public class FileBridge {
    private final String basePath;

    public FileBridge(String basePath) {
        this.basePath = basePath;
    }

    private File resolve(String path) {
        // Normalize path: remove leading / or .password-store/
        String clean = path.replaceAll("^/+", "");
        return new File(basePath, clean);
    }

    @JavascriptInterface
    public String readFile(String path) {
        try {
            File f = resolve(path);
            if (!f.exists() || !f.isFile()) return "";
            FileInputStream in = new FileInputStream(f);
            byte[] data = new byte[(int) f.length()];
            int read = in.read(data);
            in.close();
            if (read <= 0) return "";
            return Base64.encodeToString(data, Base64.NO_WRAP);
        } catch (Exception e) {
            return "";
        }
    }

    @JavascriptInterface
    public void writeFile(String path, String base64Content) {
        try {
            File f = resolve(path);
            f.getParentFile().mkdirs();
            byte[] data = Base64.decode(base64Content, Base64.DEFAULT);
            FileOutputStream out = new FileOutputStream(f);
            out.write(data);
            out.close();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @JavascriptInterface
    public String listFiles(String dirPath) {
        try {
            File d = resolve(dirPath);
            if (!d.exists() || !d.isDirectory()) return "[]";
            StringBuilder json = new StringBuilder("[");
            boolean first = true;
            listRecursive(d, first, json);
            json.append("]");
            return json.toString();
        } catch (Exception e) {
            return "[]";
        }
    }

    private boolean listRecursive(File dir, boolean first, StringBuilder json) {
        File[] files = dir.listFiles();
        if (files == null) return first;

        // Sort: directories first, then alphabetically
        Arrays.sort(files, (a, b) -> {
            if (a.isDirectory() != b.isDirectory()) return a.isDirectory() ? -1 : 1;
            return a.getName().compareTo(b.getName());
        });

        for (File f : files) {
            String name = f.getName();
            if (name.startsWith(".")) continue;
            if (name.endsWith(".meta.json")) continue;

            if (f.isDirectory()) {
                String relPath = f.getAbsolutePath().substring(basePath.length() + 1);
                if (!first) json.append(",");
                first = false;
                json.append("{\"name\":\"").append(escape(name))
                    .append("\",\"path\":\"").append(escape(relPath))
                    .append("\",\"isDir\":true}");
                first = listRecursive(f, first, json);
            } else if (name.endsWith(".gpg")) {
                String relPath = f.getAbsolutePath().substring(basePath.length() + 1);
                if (!first) json.append(",");
                first = false;
                json.append("{\"name\":\"").append(escape(name.replace(".gpg", "")))
                    .append("\",\"path\":\"").append(escape(relPath))
                    .append("\",\"isDir\":false}");
            }
        }
        return first;
    }

    @JavascriptInterface
    public void delete(String path) {
        deleteRecursive(resolve(path));
    }

    private void deleteRecursive(File f) {
        if (f.isDirectory()) {
            File[] children = f.listFiles();
            if (children != null) {
                for (File c : children) deleteRecursive(c);
            }
        }
        f.delete();
    }

    @JavascriptInterface
    public void mkdir(String dirPath) {
        resolve(dirPath).mkdirs();
    }

    @JavascriptInterface
    public boolean exists(String path) {
        return resolve(path).exists();
    }

    @JavascriptInterface
    public String readFileText(String path) {
        try {
            File f = resolve(path);
            if (!f.exists() || !f.isFile()) return "";
            FileInputStream in = new FileInputStream(f);
            byte[] data = new byte[(int) f.length()];
            int read = in.read(data);
            in.close();
            if (read <= 0) return "";
            return new String(data, "UTF-8");
        } catch (Exception e) {
            return "";
        }
    }

    @JavascriptInterface
    public void writeFileText(String path, String content) {
        try {
            File f = resolve(path);
            f.getParentFile().mkdirs();
            FileOutputStream out = new FileOutputStream(f);
            out.write(content.getBytes("UTF-8"));
            out.close();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private String escape(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"")
                .replace("\n", "\\n").replace("\r", "\\r")
                .replace("\t", "\\t");
    }
}
