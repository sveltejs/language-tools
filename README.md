# Svelte Language Server

A language server (implementing the [language server protocol](https://microsoft.github.io/language-server-protocol/))
for Svelte.

## What is a language server?

From https://microsoft.github.io/language-server-protocol/overview

> The idea behind a Language Server is to provide the language-specific smarts inside a server that can communicate with development tooling over a protocol that enables inter-process communication.

In simpler terms, this allows editor and addon devs to add support for svelte specific 'smarts' (e.g. diagnostics, autocomplete, etc) to any editor without reinventing the wheel.

## Features

Svelte language server is under development and the list of features will surely grow over time.

Currently Supported:

*   Svelte
    *   Diagnostic messages for warnings and errors
*   HTML
    *   Hover information for built-in elements
