#!/usr/bin/env node

import * as git from "simple-git";
import prompts from "prompts";

const gitClient = git();

type Cmd = "commit" | "summary" | "pr-title";

async function run() {
  const args = process.argv.slice(2);
  const cmd = args[0] as Cmd | undefined;

  if (!cmd || !["commit", "summary", "pr-title"].includes(cmd)) {
    console.log("Usage: git-buddy <commit|summary|pr-title>");
    process.exit(1);
  }

  if (cmd === "commit") {
    await commitHelper();
  } else if (cmd === "summary") {
    await summaryHelper();
  } else if (cmd === "pr-title") {
    await prTitleHelper();
  }
}

async function commitHelper() {

  const diffSummary = await gitClient.diffSummary(["--staged"]);
  if (diffSummary.files.length === 0) {
    console.log("No staged changes found. Stage files before committing.");
    process.exit(1);
  }

 
  const types = [
    "feat: A new feature",
    "fix: A bug fix",
    "docs: Documentation changes",
    "style: Code style changes (formatting, etc)",
    "refactor: Code refactoring",
    "perf: Performance improvements",
    "test: Adding or fixing tests",
    "chore: Maintenance tasks",
  ];

  const response = await prompts([
    {
      type: "select",
      name: "type",
      message: "Select commit type",
      choices: types.map((t) => ({ title: t, value: t.split(":")[0] })),
    },
    {
      type: "text",
      name: "scope",
      message: "Enter scope (optional)",
      initial: "",
    },
    {
      type: "text",
      name: "description",
      message: "Write a short, imperative description",
      validate: (value) => (value.length > 0 ? true : "Description cannot be empty"),
    },
  ]);

  const scopePart = response.scope ? `(${response.scope.trim()})` : "";
  const commitMsg = `${response.type}${scopePart}: ${response.description.trim()}`;

  console.log("\nCommit message preview:");
  console.log(commitMsg);

  const confirm = await prompts({
    type: "confirm",
    name: "confirm",
    message: "Commit with this message?",
    initial: true,
  });

  if (!confirm.confirm) {
    console.log("Commit cancelled.");
    process.exit(0);
  }

  try {
    await gitClient.commit(commitMsg);
    console.log("Committed successfully!");
  } catch (e) {
    console.error("Commit failed:", e);
  }
}

async function summaryHelper() {
  const branchSummary = await gitClient.branch();
  const currentBranch = branchSummary.current;
  const baseBranch = "main";

  if (currentBranch === baseBranch) {
    console.log(`You are on the base branch (${baseBranch}). No changes to summarize.`);
    process.exit(0);
  }

  console.log(`Summarizing changes on branch '${currentBranch}' compared to '${baseBranch}'...\n`);

  try {
    const diff = await gitClient.diffSummary([`${baseBranch}...${currentBranch}`]);

    if (diff.files.length === 0) {
      console.log("No differences found.");
      process.exit(0);
    }

    diff.files.forEach((file) => {
      console.log(`${file.file}: +${file.insertions} -${file.deletions}`);
    });
  } catch (e) {
    console.error("Error fetching diff summary:", e);
  }
}

async function prTitleHelper() {
  const baseBranch = "main";
  const log = await gitClient.log({ from: baseBranch, to: "HEAD" });

  if (log.total === 0) {
    console.log("No commits found compared to base branch.");
    process.exit(0);
  }

  
  const firstMsg = log.all[log.total - 1].message;

  
  const typeCount: Record<string, number> = {};

  log.all.forEach((commit) => {
    const match = commit.message.match(/^(\w+)(\(.+\))?:/);
    if (match) {
      const type = match[1];
      typeCount[type] = (typeCount[type] || 0) + 1;
    }
  });

  const summaryParts = Object.entries(typeCount)
    .map(([type, count]) => `${count} ${type}${count > 1 ? "s" : ""}`)
    .join(", ");

  console.log("Suggested PR title:");
  console.log(firstMsg);
  console.log("\nCommit type summary:");
  console.log(summaryParts || "No conventional commit types detected.");
}

run();
