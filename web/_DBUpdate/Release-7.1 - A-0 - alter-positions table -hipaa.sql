/*
   sábado, 19 de diciembre de 201522:20:09
   User: 
   Server: localhost\SQLEXPRESS
   Database: loconomics
   Application: 
*/

/* To prevent any potential data loss issues, you should review this script in detail before running it outside the context of the database designer.*/
BEGIN TRANSACTION
SET QUOTED_IDENTIFIER ON
SET ARITHABORT ON
SET NUMERIC_ROUNDABORT OFF
SET CONCAT_NULL_YIELDS_NULL ON
SET ANSI_NULLS ON
SET ANSI_PADDING ON
SET ANSI_WARNINGS ON
COMMIT
BEGIN TRANSACTION
GO
ALTER TABLE dbo.positions ADD
	AddGratuity int NOT NULL CONSTRAINT DF_positions_AddGratuity DEFAULT ((0)),
	HIPAA bit NOT NULL CONSTRAINT DF_positions_HIPAA DEFAULT ((0)),
	SendReviewReminderToClient bit NOT NULL CONSTRAINT DF_positions_SendReviewReminderToClient DEFAULT ((1))
GO
ALTER TABLE dbo.positions SET (LOCK_ESCALATION = TABLE)
GO
COMMIT
select Has_Perms_By_Name(N'dbo.positions', 'Object', 'ALTER') as ALT_Per, Has_Perms_By_Name(N'dbo.positions', 'Object', 'VIEW DEFINITION') as View_def_Per, Has_Perms_By_Name(N'dbo.positions', 'Object', 'CONTROL') as Contr_Per 