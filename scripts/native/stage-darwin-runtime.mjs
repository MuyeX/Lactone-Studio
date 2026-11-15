export function makeDirectoryTreeWritable(rootDir) {
  if (!fs.existsSync(rootDir)) return;
  const stack = [rootDir];
  while (stack.length > 0) {
    const dir = stack.pop();
    try {
      const st = fs.lstatSync(dir);
      if (st.isDirectory()) {
        fs.chmodSync(dir, st.mode | 0o200);
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          const childStat = fs.lstatSync(full);
          if (childStat.isDirectory()) {
            stack.push(full);
          } else if (childStat.isFile()) {
            fs.chmodSync(full, childStat.mode | 0o200);
          }
        }
      } else if (st.isFile()) {
        fs.chmodSync(dir, st.mode | 0o200);
      }
    } catch {
      // ignore
    }
  }
}

function cleanupStaleStageArtifacts(parentDir) {
  if (!fs.existsSync(parentDir)) return;
  for (const entry of fs.readdirSync(parentDir, { withFileTypes: true })) {
    if (!entry.name.startsWith(".stage-next-") && !entry.name.startsWith(".stage-bak-")) {
      continue;
    }
    const fullPath = path.join(parentDir, entry.name);
    try {
      if (fs.existsSync(fullPath)) {
        makeDirectoryTreeWritable(fullPath);
        fs.rmSync(fullPath, { recursive: true, force: true });
      }
    } catch {
      // ignore stale temporary artifacts opportunistically
    }
  }
}

function renameWithPermissionRetry(sourcePath, targetPath, renameFn = fs.renameSync) {
  const parentDir = path.dirname(targetPath);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      renameFn(sourcePath, targetPath);
      return;
    } catch (err) {
      if (!err || (err.code !== "EACCES" && err.code !== "EPERM")) {
        throw err;
      }
      if (fs.existsSync(parentDir)) {
        makeDirectoryTreeWritable(parentDir);
      }
      if (fs.existsSync(sourcePath)) {
        makeDirectoryTreeWritable(sourcePath);
      }
      if (fs.existsSync(targetPath)) {
        makeDirectoryTreeWritable(targetPath);
      }
      cleanupStaleStageArtifacts(parentDir);
      if (attempt === 2) {
        throw err;
      }
    }
  }
}

