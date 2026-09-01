# Dispatch

People, housing and fleet management with full traceability.

Tracks who's where, who's using what, and logs everything for audit.

## Problema

Falta de visão integrada sobre quem está onde e quem usa cada ativo (alojamento, veículo). Controle informal gera risco de segurança, custo desnecessário e decisões sem dados confiáveis.

## O que o sistema faz

- Cadastra colaboradores, alojamentos e veículos.
- Registra quem está em qual alojamento e por quanto tempo.
- Registra quem usa qual veículo, quando e com quem.
- Gera relatórios: ocupação, uso de frota, ociosidade.
- Mantém log de tudo que foi alterado, para consulta e auditoria.

## Stack

- Python (local, empacotado como .exe via PyInstaller)
- SQLite (evolui para Postgres se precisar de multiusuário)
- IA opcional: Groq (consultas em linguagem natural sobre os dados)

## Roadmap

1. Cadastros básicos (pessoas, alojamento, frota) e vínculos entre eles.
2. Relatórios.
3. IA para consulta em linguagem natural.
4. Empacotar em .exe e testar em outra máquina.

## Grupo DevCore

Bruno, Antonio, João, Henrique, Kelvin, Matheus, Vinicius

Cliente: Eficaz Marketing (Marília/SP)
