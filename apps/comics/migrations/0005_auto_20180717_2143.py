# Generated by Django 2.0.7 on 2018-07-18 02:43

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('comics', '0004_auto_20180711_2032'),
    ]

    operations = [
        migrations.AddField(
            model_name='comic',
            name='background_color',
            field=models.CharField(default='white', max_length=24),
        ),
        migrations.AddField(
            model_name='comic',
            name='overflow_color',
            field=models.CharField(default='white', max_length=24),
        ),
    ]
