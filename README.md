# NoIssue

## Overview

NoIssue is an innovative front-end component designed to streamline the development workflow for programmers who don't have the luxury of a dual-monitor setup or just want to keep their dev-admin work close to their normal workflow. This tool seamlessly integrates with your GitHub repositories, providing a comprehensive view of all issues and enabling developers to interact with them directly through the front-end interface. It is especially handy for developers who need to keep an eye on their GitHub repositories while actively working on other applications.

By using NoIssue, developers can not only view issues across all repositories they have access to (given an access key), but also engage with them by adding labels and comments to each individual issue.

## Live Demo

Experience the power of NoIssue with this live demo:
[NoIssue Live Demo](https://stately.ai/viz/cafd2794-6108-460c-8adb-94b59c70f9ed)

## Getting Started

Follow these steps to set up NoIssue on your local machine:

```bash
npm install
npm start
```

## Features

### MUI Dialog Component

The MUI Dialog Component is an integral part of NoIssue. Through a user-friendly and intuitive interface, it empowers developers to efficiently manage their GitHub issues. Here’s what you can do with the MUI Dialog Component:

- **Select a GitHub Repository**: Easily browse and select any repository that you have access to.
- **Choose Issue Labels**: Filter and choose issue labels within the selected repository to streamline your focus.
- **Add Comments**: Actively engage by adding insightful comments to the issues at hand.

## XState Feature

### Issues for Repository State Machine

NoIssue utilizes `XState`, a library for creating state machines and statecharts, to manage the application's states and transitions. The key state machine in NoIssue is the `issuesForRepoMachine`, which manages the state of issues for a selected repository.

The `issuesForRepoMachine` is structured with several states to facilitate the loading and interaction with GitHub repositories and issues. Here are the key states:

- **loadingAllRepos**: This is the initial state. The machine starts by fetching all the repositories. Upon successful loading, it transitions to the `waitingToChooseRepo` state. In case of an error, it transitions to the `rejected` state.

- **waitingToChooseRepo**: In this state, the machine waits for the user to select a repository. Once a repository is selected, it creates labels that don’t already exist for the repository and transitions to the `loadingAllIssuesForRepo` state.

- **loadingAllIssuesForRepo**: After a repository is selected, this state is responsible for fetching all issues for the selected repository. If successful, it transitions to `waitingToChooseIssue`; otherwise, it goes to `rejected`.

- **waitingToChooseIssue**: Here, the machine waits for the user to select an issue. When an issue is chosen, it assigns a label to the issue and transitions to `displayingIssueModal`.

- **displayingIssueModal**: In this state, an issue modal is displayed, allowing the user to interact with the selected issue. The user can add comments, change conditions, submit the issue for code review, or close the modal. Closing the modal transitions the state back to `waitingToChooseIssue`.

- **rejected**: This state represents when there is an error in loading. It can transition to the `idle` state on fetching again.

- **idle**: This is a resting state with no particular actions or transitions.

- **waitingForInput**: This is a final state when the machine is waiting for input before it can proceed or finish.

The state machine ensures a smooth and error-resistant flow through the different stages of interacting with GitHub repositories and issues. It makes the application more predictable and easier to debug and maintain.


## Conclusion

NoIssue is more than just a tool - it is your companion in achieving an optimized workflow. It is built to provide direct access to GitHub issues, eliminating the need for relentless toggling between applications. It is especially crafted for those working on a single monitor, as it makes multitasking not only possible but efficient and productive. Embrace NoIssue, and elevate your development experience to unprecedented heights.