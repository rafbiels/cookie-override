## &nbsp;![Cookie Override icon](icons/cookie-override-24.png) Cookie Override browser extension

The extension allows to add rules overriding specific cookie values whenever
a website producing the cookie is visited. This allows, for example, to persist
and force website preferences like language and location despite removing
cookies on browser exit (which is a browser option some people concerned about
their privacy may enable). The preferences can be stored as rules in the
extension and applied automatically when a page is visited, while keeping the
page unaware of the user's previous visits.

For usage instructions see [doc/HowToConfigure.md](doc/HowToConfigure.md).

### Known limitations
The override cannot work on any website which uses scripts to auto-configure the
cookies on every visit even if the cookie is already present. Such scripts keep
overriding the Cookie Override changes. If anyone has an idea for a solution to
this limitation, please let me know by opening a new
[Issue](https://github.com/rafbiels/cookie-override/issues).

----

The extension icon is a derivative work based on icons made by
[Freepik](https://www.freepik.com) from [Flaticon](https://www.flaticon.com/).
