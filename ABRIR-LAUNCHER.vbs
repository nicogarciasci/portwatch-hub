' PortWatch Hub - abre o app sem janela de console.
Option Explicit

Dim fso, sh, base, exe
Set fso = CreateObject("Scripting.FileSystemObject")
base = fso.GetParentFolderName(WScript.ScriptFullName)
exe = base & "\node_modules\electron\dist\electron.exe"

If Not fso.FileExists(exe) Then
  MsgBox "Dependencias nao instaladas." & vbCrLf & _
         "Abra a pasta do launcher e rode: npm install", 16, "PortWatch Hub"
  WScript.Quit 1
End If

Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = base
sh.Run """" & exe & """ .", 1, False
