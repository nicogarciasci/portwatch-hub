' PortWatch Hub - abre o app sem janela de console.
Option Explicit

Dim fso, sh, base, exe, starter
Set fso = CreateObject("Scripting.FileSystemObject")
base = fso.GetParentFolderName(WScript.ScriptFullName)
exe = base & "\node_modules\electron\dist\electron.exe"

Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = base

If Not fso.FileExists(exe) Then
  starter = base & "\INICIAR.cmd"
  If fso.FileExists(starter) Then
    sh.Run """" & starter & """", 1, False
    WScript.Quit 0
  End If
  MsgBox "Dependencias nao instaladas." & vbCrLf & _
         "Abra a pasta do launcher e rode INICIAR.cmd, ou: npm install", 16, "PortWatch Hub"
  WScript.Quit 1
End If

sh.Run """" & exe & """ .", 1, False
