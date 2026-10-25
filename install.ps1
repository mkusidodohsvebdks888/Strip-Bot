=Split-Path -Parent $MyInvocation.MyCommand.Path
[IO.File]::WriteAllText('G:\p\Page07\exports\7z-sfx-test-result.txt',"base=$base`ncomplete=True")
