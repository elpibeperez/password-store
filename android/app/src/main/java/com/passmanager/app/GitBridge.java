package com.passmanager.app;

import android.webkit.JavascriptInterface;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.Status;
import org.eclipse.jgit.api.CloneCommand;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.lib.RepositoryBuilder;
import org.eclipse.jgit.transport.UsernamePasswordCredentialsProvider;
import org.eclipse.jgit.transport.CredentialsProvider;
import java.io.File;
import java.util.Set;

public class GitBridge {
    private final String repoPath;
    private Git git;
    private String storedToken = "";

    public GitBridge(String repoPath) {
        this.repoPath = repoPath;
    }

    private CredentialsProvider auth() {
        return auth(storedToken);
    }

    private synchronized Git getGit() throws Exception {
        if (git == null) {
            File repoDir = new File(repoPath, ".git");
            if (repoDir.exists()) {
                Repository repo = new RepositoryBuilder()
                    .setGitDir(repoDir)
                    .readEnvironment()
                    .findGitDir()
                    .build();
                git = new Git(repo);
            }
        }
        return git;
    }

    private CredentialsProvider auth(String token) {
        if (token == null || token.isEmpty()) return null;
        return new UsernamePasswordCredentialsProvider(token, "");
    }

    @JavascriptInterface
    public String clone(String url, String token) {
        try {
            if (token != null && !token.isEmpty()) storedToken = token;

            File dir = new File(repoPath);
            if (dir.exists()) deleteDir(dir);
            dir.mkdirs();

            CloneCommand cmd = Git.cloneRepository()
                .setURI(url)
                .setDirectory(dir)
                .setCloneAllBranches(true)
                .setNoCheckout(false);

            CredentialsProvider cp = auth();
            if (cp != null) cmd.setCredentialsProvider(cp);

            git = cmd.call();

            // Verify checkout worked - count working tree files
            int fileCount = countFiles(dir);
            return "{\"ok\":true,\"files\":" + fileCount + "}";
        } catch (Exception e) {
            e.printStackTrace();
            return "{\"ok\":false,\"error\":\"" + escape(e.getMessage()) + "\"}";
        }
    }

    private int countFiles(File dir) {
        int count = 0;
        File[] files = dir.listFiles();
        if (files == null) return 0;
        for (File f : files) {
            if (f.getName().startsWith(".")) continue;
            if (f.isDirectory()) count += countFiles(f);
            else count++;
        }
        return count;
    }

    @JavascriptInterface
    public String status() {
        try {
            Git g = getGit();
            if (g == null) return "{\"modified\":[],\"added\":[],\"deleted\":[],\"ahead\":0,\"behind\":0}";

            Status st = g.status().call();

            StringBuilder json = new StringBuilder("{");
            json.append("\"modified\":").append(toJsonArray(st.getModified()));
            json.append(",\"added\":").append(toJsonArray(st.getAdded()));
            json.append(",\"deleted\":").append(toJsonArray(st.getRemoved()));
            json.append(",\"ahead\":0,\"behind\":0");
            json.append("}");
            return json.toString();
        } catch (Exception e) {
            return "{\"modified\":[],\"added\":[],\"deleted\":[],\"ahead\":0,\"behind\":0}";
        }
    }

    @JavascriptInterface
    public String addAll() {
        try {
            Git g = getGit();
            if (g == null) return "{\"ok\":false,\"error\":\"No git repo\"}";
            g.add().addFilepattern(".").call();
            return "{\"ok\":true}";
        } catch (Exception e) {
            return "{\"ok\":false,\"error\":\"" + escape(e.getMessage()) + "\"}";
        }
    }

    @JavascriptInterface
    public String commit(String message) {
        try {
            Git g = getGit();
            if (g == null) return "{\"ok\":false,\"error\":\"No git repo\"}";
            g.commit()
                .setMessage(message)
                .setAuthor("password-store", "pass@local")
                .setCommitter("password-store", "pass@local")
                .call();
            return "{\"ok\":true}";
        } catch (Exception e) {
            return "{\"ok\":false,\"error\":\"" + escape(e.getMessage()) + "\"}";
        }
    }

    @JavascriptInterface
    public String pull(String token) {
        try {
            if (token != null && !token.isEmpty()) storedToken = token;

            Git g = getGit();
            if (g == null) return "{\"ok\":false,\"error\":\"No git repo\"}";

            org.eclipse.jgit.api.PullCommand cmd = g.pull()
                .setFastForward(org.eclipse.jgit.api.MergeCommand.FastForwardMode.FF_ONLY);

            CredentialsProvider cp = auth();
            if (cp != null) cmd.setCredentialsProvider(cp);

            cmd.call();
            return "{\"ok\":true}";
        } catch (Exception e) {
            return "{\"ok\":false,\"error\":\"" + escape(e.getMessage()) + "\"}";
        }
    }

    @JavascriptInterface
    public String push(String token) {
        try {
            if (token != null && !token.isEmpty()) storedToken = token;

            Git g = getGit();
            if (g == null) return "{\"ok\":false,\"error\":\"No git repo\"}";

            org.eclipse.jgit.api.PushCommand cmd = g.push();

            CredentialsProvider cp = auth();
            if (cp != null) cmd.setCredentialsProvider(cp);

            cmd.call();
            return "{\"ok\":true}";
        } catch (Exception e) {
            return "{\"ok\":false,\"error\":\"" + escape(e.getMessage()) + "\"}";
        }
    }

    @JavascriptInterface
    public String getRemote() {
        try {
            Git g = getGit();
            if (g == null) return "";
            String url = g.getRepository().getConfig().getString("remote", "origin", "url");
            return url != null ? url : "";
        } catch (Exception e) {
            return "";
        }
    }

    @JavascriptInterface
    public String getBranch() {
        try {
            Git g = getGit();
            if (g == null) return "";
            return g.getRepository().getBranch();
        } catch (Exception e) {
            return "";
        }
    }

    @JavascriptInterface
    public boolean hasRepo() {
        return new File(repoPath, ".git").exists();
    }

    private void deleteDir(File dir) {
        File[] files = dir.listFiles();
        if (files != null) {
            for (File f : files) {
                if (f.isDirectory()) deleteDir(f);
                else f.delete();
            }
        }
        dir.delete();
    }

    private String toJsonArray(Set<String> set) {
        StringBuilder sb = new StringBuilder("[");
        boolean first = true;
        for (String s : set) {
            if (s.endsWith(".meta.json")) continue;
            if (s.startsWith(".")) continue;
            if (!first) sb.append(",");
            first = false;
            sb.append("\"").append(escape(s)).append("\"");
        }
        sb.append("]");
        return sb.toString();
    }

    private String escape(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"")
                .replace("\n", "\\n").replace("\r", "\\r");
    }
}
